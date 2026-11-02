"use strict";
/**
 * Subprocess client for the CODESYS-shipped MCP bridge (CodesysMCPBridge.exe
 * shim that ships in CODESYS 3.5.22.10+ next to CODESYS.exe). The shim is
 * the only piece that speaks MCP; it forwards each call to the in-IDE
 * plugin via a private named pipe whose wire format is not MCP-compatible,
 * so we go through the shim's stdio rather than the pipe directly.
 *
 * Why: the bridge plugin runs in-process inside CODESYS, so its authoring
 * tools (create_or_replace_structured_text_object, browse_project_tree, ...)
 * mutate the live project graph and the editor view picks the change up
 * immediately. Our existing IronPython watcher modifies the project graph
 * from a primary-thread script but never touches the editor layer, so POUs
 * don't pop open as they change. Wrapping the bridge gives us that live view
 * for free on SP22+, while keeping the watcher as the SP19/SP21 fallback and
 * the home of every online/runtime/release tool the bridge doesn't ship.
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
exports.IdeBridgeClient = void 0;
exports.findOrphanedBridgePids = findOrphanedBridgePids;
exports.killOrphanedBridges = killOrphanedBridges;
exports.bridgeSchemaToZodShape = bridgeSchemaToZodShape;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const zod_1 = require("zod");
const logger_1 = require("./logger");
/** Image name of the CODESYS-shipped bridge shim, used by the orphan sweep. */
const BRIDGE_IMAGE_NAME = 'CodesysMCPBridge.exe';
/**
 * Find CodesysMCPBridge.exe processes that have been orphaned — i.e. whose
 * parent process is no longer alive. Such a bridge can never be re-attached
 * to (the stdio pipe that drove it died with its parent), so it is pure
 * garbage and safe to kill.
 *
 * Why dead-parent rather than "all bridges": a single sweep must not touch a
 * bridge that belongs to a *live* MCP session — both the `codesys-ide` direct
 * server (spawned by the MCP client) and a concurrently-running orchestrator
 * keep a living parent, so they are correctly preserved. Only the leftovers
 * from sessions that already exited are reaped.
 *
 * Returns an empty list on non-Windows or if the probe fails — we treat that
 * as "can't tell" rather than risk killing something we shouldn't.
 */
function findOrphanedBridgePids() {
    if (process.platform !== 'win32')
        return [];
    try {
        // One PowerShell pass: build a set of all live PIDs, then keep the bridge
        // processes whose ParentProcessId is absent from it.
        //
        // Note: only SINGLE quotes are used inside the command. The whole script is
        // passed via `-Command "<here>"`, so an embedded double quote (e.g. a CIM
        // `-Filter "Name='...'"`) would prematurely close that argument and the
        // command would silently fail — hence Where-Object on $_.Name instead.
        // Both the live-PID keys and the ParentProcessId lookup are cast to [int]
        // so an int key never misses a UInt32 ParentProcessId.
        // ConvertTo-Json emits a bare value for a single match, an array for many.
        const ps = `$alive=@{}; Get-Process -ErrorAction SilentlyContinue | ForEach-Object { $alive[[int]$_.Id]=$true }; ` +
            `Get-CimInstance Win32_Process -ErrorAction SilentlyContinue ` +
            `| Where-Object { $_.Name -eq '${BRIDGE_IMAGE_NAME}' -and -not $alive[[int]$_.ParentProcessId] } ` +
            `| Select-Object -ExpandProperty ProcessId ` +
            `| ConvertTo-Json -Compress`;
        const out = (0, child_process_1.execSync)(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${ps}"`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 10000 });
        const trimmed = out.trim();
        if (!trimmed)
            return [];
        const parsed = JSON.parse(trimmed);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        return arr.filter((v) => typeof v === 'number' && Number.isInteger(v));
    }
    catch {
        return [];
    }
}
/**
 * Kill any orphaned bridge shims (see {@link findOrphanedBridgePids}). Returns
 * the PIDs actually reaped. Called at server startup so each fresh orchestrator
 * cleans up the garbage left by sessions that exited without reaping their
 * bridge (e.g. a hard SIGKILL of a prior orchestrator, or a stale `codesys-ide`
 * direct-server bridge whose MCP client has since closed).
 */
function killOrphanedBridges() {
    const pids = findOrphanedBridgePids();
    const killed = [];
    for (const pid of pids) {
        try {
            (0, child_process_1.execSync)(`taskkill /PID ${pid}`, { timeout: 5000, stdio: 'ignore' });
            killed.push(pid);
        }
        catch {
            try {
                (0, child_process_1.execSync)(`taskkill /F /PID ${pid}`, { timeout: 5000, stdio: 'ignore' });
                killed.push(pid);
            }
            catch {
                // ignore — a survivor will show up on the next sweep
            }
        }
    }
    return killed;
}
/**
 * JSON-RPC 2.0 client over a child-process stdio pair. The bridge shim
 * (`CodesysMCPBridge.exe`) speaks newline-delimited MCP/JSON-RPC and
 * forwards each call to the in-IDE plugin via its own named pipe.
 */
class IdeBridgeClient {
    constructor(exePath) {
        this.exePath = exePath;
        this.proc = null;
        this.nextId = 1;
        this.pending = new Map();
        this.buffer = '';
        this.connected = false;
    }
    /** PID of the spawned bridge shim, or null if not currently connected. */
    get pid() {
        return this.proc?.pid ?? null;
    }
    /**
     * Default location of the bridge shim alongside CODESYS.exe. Returns null
     * if the bridge isn't installed (SP19/SP21, or SP22+ before the user has
     * upgraded the install to one that ships the bridge).
     */
    static defaultExePath(codesysExePath) {
        // CODESYS.exe lives at <install>/CODESYS/Common/CODESYS.exe; the bridge
        // lives at <install>/CODESYS/CodesysMCPBridge/CodesysMCPBridge.exe.
        const installRoot = path.resolve(path.dirname(codesysExePath), '..');
        const candidate = path.join(installRoot, 'CodesysMCPBridge', 'CodesysMCPBridge.exe');
        return fs.existsSync(candidate) ? candidate : null;
    }
    /**
     * Spawn the bridge shim and wire up its stdio. Resolves once the process
     * has started; the MCP `initialize` handshake is a separate call.
     */
    async connect(timeoutMs = 2000) {
        if (this.connected)
            return;
        if (!fs.existsSync(this.exePath)) {
            throw new Error(`Bridge shim not found at ${this.exePath}`);
        }
        await new Promise((resolve, reject) => {
            const proc = (0, child_process_1.spawn)(this.exePath, [], { stdio: ['pipe', 'pipe', 'pipe'] });
            const timer = setTimeout(() => {
                proc.kill();
                reject(new Error(`Bridge shim did not start within ${timeoutMs}ms: ${this.exePath}`));
            }, timeoutMs);
            proc.once('error', (err) => {
                clearTimeout(timer);
                reject(err);
            });
            proc.once('spawn', () => {
                clearTimeout(timer);
                this.proc = proc;
                this.connected = true;
                proc.stdout.on('data', (chunk) => this.onData(chunk));
                proc.stderr.on('data', (chunk) => {
                    // Bridge shim logs go through stderr — surface them for debugging
                    // but don't treat them as fatal.
                    const line = chunk.toString('utf8').trim();
                    if (line)
                        logger_1.serverLog.debug(`[bridge] ${line}`);
                });
                proc.on('exit', (code, signal) => this.onProcExit(code, signal));
                resolve();
            });
        });
    }
    /**
     * MCP `initialize` handshake. Must be called once before any other request.
     */
    async initialize() {
        const result = (await this.request('initialize', {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'codesys-mcp-master/ide-bridge', version: '0.1' },
        }));
        logger_1.serverLog.info(`Bridge initialize OK (protocolVersion=${result?.protocolVersion ?? 'unknown'})`);
        // MCP requires a notification after initialize.
        this.notify('notifications/initialized', {});
    }
    /** Fetch the bridge's tool list. */
    async listTools() {
        const result = (await this.request('tools/list', {}));
        return result?.tools ?? [];
    }
    /** Call a bridge tool by name with raw arguments. Returns the bridge's result envelope unchanged. */
    async callTool(name, args) {
        return await this.request('tools/call', { name, arguments: args });
    }
    /** Kill the bridge shim. Safe to call repeatedly. */
    close() {
        if (!this.connected)
            return;
        this.connected = false;
        const pid = this.proc?.pid;
        try {
            this.proc?.stdin.end();
        }
        catch {
            /* swallow */
        }
        this.proc?.kill();
        // Node's proc.kill() can silently no-op on Windows if the handle is
        // already stale, leaving an orphan. Force the kill via taskkill so the
        // shim never survives us.
        if (pid && process.platform === 'win32') {
            try {
                (0, child_process_1.execSync)(`taskkill /F /PID ${pid}`, { timeout: 5000, stdio: 'ignore' });
            }
            catch {
                /* already gone, or taskkill unavailable — best effort */
            }
        }
        this.proc = null;
        for (const [, p] of this.pending) {
            if (p.timer)
                clearTimeout(p.timer);
            p.reject(new Error('Bridge connection closed'));
        }
        this.pending.clear();
    }
    request(method, params, timeoutMs = 60000) {
        if (!this.connected || !this.proc) {
            return Promise.reject(new Error('Bridge not connected'));
        }
        const id = this.nextId++;
        const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`Bridge request '${method}' timed out after ${timeoutMs}ms`));
            }, timeoutMs);
            this.pending.set(id, { resolve, reject, timer });
            this.proc.stdin.write(payload);
        });
    }
    notify(method, params) {
        if (!this.connected || !this.proc)
            return;
        this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
    }
    onData(chunk) {
        this.buffer += chunk.toString('utf8');
        let idx;
        while ((idx = this.buffer.indexOf('\n')) >= 0) {
            const line = this.buffer.slice(0, idx).trim();
            this.buffer = this.buffer.slice(idx + 1);
            if (!line)
                continue;
            this.dispatch(line);
        }
    }
    dispatch(line) {
        let msg;
        try {
            msg = JSON.parse(line);
        }
        catch (err) {
            logger_1.serverLog.warn(`Bridge sent non-JSON line: ${line.slice(0, 200)}`);
            return;
        }
        if (typeof msg.id !== 'number')
            return; // notification, ignore
        const p = this.pending.get(msg.id);
        if (!p)
            return;
        this.pending.delete(msg.id);
        if (p.timer)
            clearTimeout(p.timer);
        if (msg.error) {
            p.reject(new Error(`Bridge error ${msg.error.code}: ${msg.error.message}`));
        }
        else {
            p.resolve(msg.result);
        }
    }
    onProcExit(code, signal) {
        if (!this.connected)
            return;
        this.connected = false;
        const why = signal ? `signal ${signal}` : `exit ${code}`;
        for (const [, p] of this.pending) {
            if (p.timer)
                clearTimeout(p.timer);
            p.reject(new Error(`Bridge shim exited (${why})`));
        }
        this.pending.clear();
    }
}
exports.IdeBridgeClient = IdeBridgeClient;
/**
 * Minimal JSON-Schema-to-Zod-shape converter. The MCP SDK's `tool()` API takes
 * a Record<string, ZodType> describing the args; the bridge gives us a full
 * JSON-Schema object whose `properties` map onto exactly that shape. Anything
 * we don't recognise falls back to z.unknown() so the call still goes through.
 */
function bridgeSchemaToZodShape(schema) {
    const shape = {};
    if (!schema || !schema.properties)
        return shape;
    const required = new Set(schema.required ?? []);
    for (const [key, propSchema] of Object.entries(schema.properties)) {
        let zodType = jsonSchemaToZod(propSchema);
        if (propSchema.description)
            zodType = zodType.describe(propSchema.description);
        if (!required.has(key))
            zodType = zodType.optional();
        shape[key] = zodType;
    }
    return shape;
}
function jsonSchemaToZod(schema) {
    // Handle nullable via type-union `["string", "null"]`.
    const type = Array.isArray(schema.type) ? schema.type.filter((t) => t !== 'null')[0] : schema.type;
    const nullable = Array.isArray(schema.type) && schema.type.includes('null');
    let base;
    if (schema.enum && schema.enum.length > 0 && schema.enum.every((v) => typeof v === 'string')) {
        base = zod_1.z.enum(schema.enum);
    }
    else {
        switch (type) {
            case 'string':
                base = zod_1.z.string();
                break;
            case 'integer':
            case 'number':
                base = zod_1.z.number();
                break;
            case 'boolean':
                base = zod_1.z.boolean();
                break;
            case 'array': {
                const items = Array.isArray(schema.items) ? schema.items[0] : schema.items;
                base = zod_1.z.array(items ? jsonSchemaToZod(items) : zod_1.z.unknown());
                break;
            }
            case 'object':
                // For nested objects we don't recursively type — the bridge will validate.
                base = zod_1.z.record(zod_1.z.unknown());
                break;
            default:
                base = zod_1.z.unknown();
        }
    }
    return nullable ? base.nullable() : base;
}
//# sourceMappingURL=ide-bridge.js.map