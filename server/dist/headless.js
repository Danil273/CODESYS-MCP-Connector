"use strict";
/**
 * Headless fallback mode — spawns CODESYS with --noUI per command.
 * Direct port of the original codesys_interop.js approach.
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
exports.HeadlessExecutor = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const child_process_1 = require("child_process");
const logger_1 = require("./logger");
const SCRIPT_SUCCESS_MARKER = 'SCRIPT_SUCCESS';
const SCRIPT_ERROR_MARKER = 'SCRIPT_ERROR';
// Each headless call boots a whole CODESYS (60-80 s on SP19/SP21), so 60 s was too short.
const DEFAULT_TIMEOUT_MS = 180000;
class HeadlessExecutor {
    constructor(config) {
        this.config = config;
        // Validate CODESYS exe exists
        if (!fs.existsSync(config.codesysPath)) {
            throw new Error(`CODESYS executable not found: ${config.codesysPath}`);
        }
    }
    /** Execute a script by spawning CODESYS with --noUI */
    async executeScript(scriptContent, timeoutMs) {
        const timeout = Math.max(timeoutMs ?? 0, this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS);
        const tempDir = os.tmpdir();
        const tempFileName = `codesys_script_${Date.now()}_${Math.random()
            .toString(36)
            .substring(2, 9)}.py`;
        const tempFilePath = path.join(tempDir, tempFileName);
        const requestId = `headless_${Date.now()}`;
        const codesysDir = path.dirname(this.config.codesysPath);
        try {
            // Write script to temp file
            const normalized = scriptContent.replace(/\r\n/g, '\n');
            fs.writeFileSync(tempFilePath, normalized, 'latin1');
            logger_1.headlessLog.debug(`Temp script written: ${tempFilePath}`);
            // Build command
            const quotedExe = `"${this.config.codesysPath}"`;
            const profileArg = `--profile="${this.config.profileName}"`;
            const folderArg = this.config.additionalFolder
                ? ` --additionalfolder="${this.config.additionalFolder}"`
                : '';
            const scriptArg = `--runscript="${tempFilePath}"`;
            const fullCommand = `${quotedExe} ${profileArg}${folderArg} --noUI ${scriptArg}`;
            logger_1.headlessLog.debug(`Spawning: ${fullCommand}`);
            // Spawn and collect output
            const result = await new Promise((resolve) => {
                let stdoutData = '';
                let stderrData = '';
                const controller = new AbortController();
                // Prepend CODESYS dir to PATH
                const spawnEnv = { ...process.env };
                const originalPath = spawnEnv.PATH || '';
                spawnEnv.PATH = `${codesysDir};${originalPath}`;
                const child = (0, child_process_1.spawn)(fullCommand, [], {
                    windowsHide: true,
                    signal: controller.signal,
                    cwd: codesysDir,
                    env: spawnEnv,
                    shell: true,
                });
                const timeoutId = setTimeout(() => {
                    logger_1.headlessLog.warn('Process timeout reached');
                    controller.abort();
                }, timeout);
                child.stdout.on('data', (data) => {
                    stdoutData += data.toString();
                });
                child.stderr.on('data', (data) => {
                    stderrData += data.toString();
                });
                child.on('error', (err) => {
                    clearTimeout(timeoutId);
                    resolve({ code: 1, stdout: stdoutData, stderr: stderrData, error: err });
                });
                child.on('close', (code) => {
                    clearTimeout(timeoutId);
                    resolve({ code, stdout: stdoutData, stderr: stderrData });
                });
                controller.signal.addEventListener('abort', () => {
                    if (!child.killed) {
                        child.kill('SIGTERM');
                        setTimeout(() => {
                            if (!child.killed)
                                child.kill('SIGKILL');
                        }, 2000);
                    }
                    resolve({
                        code: null,
                        stdout: stdoutData,
                        stderr: stderrData + '\nTIMEOUT: Process aborted.',
                    });
                }, { once: true });
            });
            // Determine success
            let success = false;
            const combinedOutput = result.stdout;
            const stderrOutput = result.stderr;
            if (result.error) {
                success = false;
            }
            else if (combinedOutput.includes(SCRIPT_SUCCESS_MARKER) ||
                stderrOutput.includes(SCRIPT_SUCCESS_MARKER)) {
                success = true;
            }
            else if (combinedOutput.includes(SCRIPT_ERROR_MARKER) ||
                stderrOutput.includes(SCRIPT_ERROR_MARKER)) {
                success = false;
            }
            else {
                success = result.code === 0;
            }
            const finalOutput = success
                ? combinedOutput
                : `${stderrOutput}\n${combinedOutput}`.trim();
            return {
                requestId,
                success,
                output: finalOutput,
                error: success ? '' : (result.error?.message || stderrOutput || `Exit code ${result.code}`),
                timestamp: Date.now(),
            };
        }
        finally {
            // Clean up temp file
            try {
                fs.unlinkSync(tempFilePath);
            }
            catch {
                logger_1.headlessLog.debug(`Failed to delete temp file: ${tempFilePath}`);
            }
        }
    }
}
exports.HeadlessExecutor = HeadlessExecutor;
//# sourceMappingURL=headless.js.map