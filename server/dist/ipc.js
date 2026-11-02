"use strict";
/**
 * File-based IPC transport layer.
 * Writes command files, polls for result files, with command serialization.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.IpcClient = exports.DEFAULT_IPC_CONFIG = void 0;
exports.progressPreamble = progressPreamble;
exports.lastProgressStage = lastProgressStage;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const uuid_1 = require("uuid");
const logger_1 = require("./logger");
/** Default IPC configuration */
/**
 * Python put in front of every script. A script calls mcp_progress('stage')
 * when it reaches a new stage; every call appends a line to the progress
 * file, and the wait for the result starts its timeout again from there.
 * So a timeout measures how long a script has been silent, not how long
 * it has run: a download that spent 8 of its 10 minutes opening, building
 * and logging in no longer runs out of time during the transfer itself
 * (2026-10-18). Valid in IronPython 2.7 and CPython 3.
 */
function progressPreamble(progressFile) {
    return [
        `MCP_PROGRESS_FILE = r'${progressFile.replace(/'/g, "\\'")}'`,
        'def mcp_progress(stage):',
        '    try:',
        '        import time as _mcp_time',
        "        _f = open(MCP_PROGRESS_FILE, 'a')",
        "        _f.write('%.1f %s\\n' % (_mcp_time.time(), stage))",
        '        _f.close()',
        '    except Exception:',
        '        pass',
        '',
        '',
    ].join('\n');
}
/** Last stage line of a progress file ('' when there is none). */
function lastProgressStage(progressFile) {
    try {
        const lines = fs.readFileSync(progressFile, 'utf-8').trim().split(/\r?\n/);
        const last = lines[lines.length - 1] ?? '';
        return last.replace(/^[0-9.]+\s+/, '');
    }
    catch {
        return '';
    }
}
exports.DEFAULT_IPC_CONFIG = {
    // Most tools first run ensure_project_open, which loads the project if it
    // is not open yet. That first load took 99 s on SP19 with the large add-on
    // folder (2026-10-05), so 60 s cut tools off that were still working.
    commandTimeoutMs: 180000,
    pollIntervalMs: 100,
    maxPollIntervalMs: 1000,
    deleteResultAfterRead: true,
};
/**
 * Async mutex for serializing commands.
 * Ensures only one command is in-flight at a time.
 */
class AsyncMutex {
    constructor() {
        this._queue = [];
        this._locked = false;
    }
    async acquire() {
        if (!this._locked) {
            this._locked = true;
            return;
        }
        return new Promise((resolve) => {
            this._queue.push(resolve);
        });
    }
    release() {
        if (this._queue.length > 0) {
            const next = this._queue.shift();
            next();
        }
        else {
            this._locked = false;
        }
    }
}
/**
 * Atomic file write: write to .tmp then rename.
 * Uses fsync to ensure data is flushed to disk before rename.
 */
async function atomicWrite(filePath, content) {
    const tmpPath = filePath + '.tmp';
    const fd = fs.openSync(tmpPath, 'w');
    try {
        fs.writeSync(fd, content, undefined, 'utf-8');
        fs.fsyncSync(fd);
    }
    finally {
        fs.closeSync(fd);
    }
    fs.renameSync(tmpPath, filePath);
}
class IpcClient {
    constructor(config) {
        this.mutex = new AsyncMutex();
        this.config = config;
        this.commandsDir = path.join(config.baseDir, 'commands');
        this.resultsDir = path.join(config.baseDir, 'results');
    }
    /** Create commands/ and results/ directories */
    async ensureDirectories() {
        fs.mkdirSync(this.commandsDir, { recursive: true });
        fs.mkdirSync(this.resultsDir, { recursive: true });
        logger_1.ipcLog.debug(`IPC directories created at ${this.config.baseDir}`);
    }
    /** Check if the watcher has written ready.signal */
    async isReady() {
        const signalPath = path.join(this.config.baseDir, 'ready.signal');
        return fs.existsSync(signalPath);
    }
    /** Write terminate.signal to request watcher shutdown */
    async sendTerminate() {
        const signalPath = path.join(this.config.baseDir, 'terminate.signal');
        await atomicWrite(signalPath, JSON.stringify({ timestamp: Date.now() }));
        logger_1.ipcLog.info('Terminate signal sent');
    }
    /**
     * Send a command to the watcher and wait for result.
     * Serialized via async mutex — only one command in-flight at a time.
     */
    /**
     * opts.abortWhen is checked on every poll: when it turns true (the CODESYS
     * process is gone) the wait ends at once instead of running out the
     * timeout, which has a 180 s floor.
     */
    async sendCommand(scriptContent, timeoutMs, opts = {}) {
        await this.mutex.acquire();
        try {
            return await this._sendCommandInternal(scriptContent, timeoutMs, opts);
        }
        finally {
            this.mutex.release();
        }
    }
    async _sendCommandInternal(scriptContent, timeoutMs, opts = {}) {
        const requestId = (0, uuid_1.v4)();
        // The configured default is a floor: a tool's own shorter timeout must not
        // cut off a command whose first step (ensure_project_open) loads the
        // project, which took 99 s on SP19 (2026-10-05). Longer per-tool values win.
        const timeout = Math.max(timeoutMs ?? 0, this.config.commandTimeoutMs);
        const scriptFileName = `${requestId}.py`;
        const commandFileName = `${requestId}.command.json`;
        const resultFileName = `${requestId}.result.json`;
        const scriptPath = path.join(this.commandsDir, scriptFileName);
        const commandPath = path.join(this.commandsDir, commandFileName);
        const resultPath = path.join(this.resultsDir, resultFileName);
        const progressPath = path.join(this.resultsDir, `${requestId}.progress`);
        logger_1.ipcLog.debug(`Sending command ${requestId}`);
        // Step 1: Write .py script file with fsync
        await atomicWrite(scriptPath, progressPreamble(progressPath) + scriptContent);
        // Step 2: Write .command.json (triggers watcher)
        const command = {
            requestId,
            scriptPath: scriptPath,
            timestamp: Date.now(),
        };
        await atomicWrite(commandPath, JSON.stringify(command));
        logger_1.ipcLog.debug(`Command ${requestId} written, polling for result...`);
        // Step 3: Poll for result with progressive backoff. The timeout runs
        // from the last progress the script reported (see progressPreamble).
        let startTime = Date.now();
        let pollInterval = this.config.pollIntervalMs;
        let progressSize = -1;
        while (Date.now() - startTime < timeout) {
            try {
                const size = fs.statSync(progressPath).size;
                if (size !== progressSize) {
                    progressSize = size;
                    startTime = Date.now();
                    logger_1.ipcLog.debug(`Command ${requestId} progress: ${lastProgressStage(progressPath)}`);
                }
            }
            catch {
                // no progress reported yet
            }
            if (fs.existsSync(resultPath)) {
                // Try to read result with retry for partial writes
                const result = await this._readResultWithRetry(resultPath, requestId);
                if (result) {
                    // Clean up result file if configured
                    if (this.config.deleteResultAfterRead) {
                        try {
                            fs.unlinkSync(resultPath);
                        }
                        catch {
                            // Ignore cleanup errors
                        }
                    }
                    try {
                        fs.unlinkSync(progressPath);
                    }
                    catch { /* none written */ }
                    logger_1.ipcLog.debug(`Command ${requestId} completed: success=${result.success}`);
                    return result;
                }
            }
            if (opts.abortWhen?.()) {
                this._cleanupCommandFiles(requestId);
                throw new Error(`Command ${requestId} abandoned: the CODESYS process is gone`);
            }
            // Progressive backoff: double interval, cap at max
            await this._sleep(pollInterval);
            pollInterval = Math.min(pollInterval * 2, this.config.maxPollIntervalMs);
        }
        // Timeout — clean up command files
        this._cleanupCommandFiles(requestId);
        const stage = lastProgressStage(progressPath);
        try {
            fs.unlinkSync(progressPath);
        }
        catch { /* none written */ }
        throw new Error(`Command ${requestId} timed out after ${timeout}ms waiting for result` +
            (stage ? ` (no progress for ${timeout}ms since: ${stage})` : ''));
    }
    /**
     * Read result file with retry for corrupted/partial JSON.
     * Up to 3 attempts with 100ms delay between.
     */
    async _readResultWithRetry(resultPath, requestId) {
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const content = fs.readFileSync(resultPath, 'utf-8');
                const result = JSON.parse(content);
                if (result.requestId === requestId) {
                    return result;
                }
                logger_1.ipcLog.warn(`Result file requestId mismatch: expected ${requestId}, got ${result.requestId}`);
                return null;
            }
            catch (err) {
                if (attempt < 2) {
                    logger_1.ipcLog.debug(`Result read attempt ${attempt + 1} failed, retrying in 100ms...`);
                    await this._sleep(100);
                }
                else {
                    logger_1.ipcLog.warn(`Failed to read result after 3 attempts for ${requestId}: ${err}`);
                    return null;
                }
            }
        }
        return null;
    }
    /** Clean up command files for a given request */
    _cleanupCommandFiles(requestId) {
        const scriptPath = path.join(this.commandsDir, `${requestId}.py`);
        const commandPath = path.join(this.commandsDir, `${requestId}.command.json`);
        try {
            if (fs.existsSync(scriptPath))
                fs.unlinkSync(scriptPath);
        }
        catch { /* ignore */ }
        try {
            if (fs.existsSync(commandPath))
                fs.unlinkSync(commandPath);
        }
        catch { /* ignore */ }
    }
    /** Remove the entire session directory */
    async cleanup() {
        try {
            fs.rmSync(this.config.baseDir, { recursive: true, force: true });
            logger_1.ipcLog.info(`Session directory cleaned up: ${this.config.baseDir}`);
        }
        catch (err) {
            logger_1.ipcLog.warn(`Failed to clean up session directory: ${err}`);
        }
    }
    _sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
exports.IpcClient = IpcClient;
//# sourceMappingURL=ipc.js.map