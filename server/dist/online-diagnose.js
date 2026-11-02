"use strict";
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
exports.defaultTcpLister = void 0;
exports.parseIpAddress = parseIpAddress;
exports.probeRuntime = probeRuntime;
exports.probeVerdict = probeVerdict;
exports.loginFailureHint = loginFailureHint;
exports.ipBindingsFile = ipBindingsFile;
exports.rememberIpBinding = rememberIpBinding;
exports.ipBindingFor = ipBindingFor;
exports.preLoginProbe = preLoginProbe;
exports.withNote = withNote;
exports.isStaleOnlineSession = isStaleOnlineSession;
exports.isGatewayNotConfigured = isGatewayNotConfigured;
exports.gatewayLinkNote = gatewayLinkNote;
exports.runWithRecovery = runWithRecovery;
exports.hasGatewayLink = hasGatewayLink;
const fs = __importStar(require("fs"));
const net = __importStar(require("net"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
/** 'host[:port]' as rebind_device_to_scan_result takes it; null if not an IP form. */
function parseIpAddress(addr, defaultPort = 11740) {
    const m = /^\s*(\d{1,3}(?:\.\d{1,3}){3}|localhost)(?::(\d{1,5}))?\s*$/i.exec(addr ?? '');
    if (!m)
        return null;
    const port = m[2] ? Number(m[2]) : defaultPort;
    if (port < 1 || port > 65535)
        return null;
    return { host: m[1], port };
}
function probeRuntime(host, port, holdMs = 1500, connectMs = 5000) {
    return new Promise((resolve) => {
        let connectedAt = 0;
        let done = false;
        const sock = new net.Socket();
        const finish = (r) => {
            if (done)
                return;
            done = true;
            clearTimeout(timer);
            sock.destroy();
            resolve({ host, port, ...r });
        };
        let timer = setTimeout(() => finish({ state: 'timeout', message: `no TCP connection to ${host}:${port} within ${connectMs} ms` }), connectMs);
        sock.once('connect', () => {
            connectedAt = Date.now();
            clearTimeout(timer);
            timer = setTimeout(() => finish({ state: 'open', message: `${host}:${port} accepted the connection and kept it open` }), holdMs);
        });
        // Any data before we speak is unexpected but means something is alive.
        sock.on('data', () => finish({ state: 'open', message: `${host}:${port} accepted the connection and answered` }));
        const closed = () => {
            if (!connectedAt)
                return;
            const ms = Date.now() - connectedAt;
            finish({ state: 'closed', closedAfterMs: ms, message: `${host}:${port} accepted the connection and closed it after ${ms} ms` });
        };
        sock.once('end', closed);
        sock.once('close', closed);
        sock.once('error', (e) => {
            if (connectedAt)
                return closed();
            if (e.code === 'ECONNREFUSED')
                finish({ state: 'refused', message: `nothing listens on ${host}:${port} (connection refused)` });
            else
                finish({ state: 'error', message: `${host}:${port}: ${e.message}` });
        });
        sock.connect(port, host);
    });
}
/**
 * Why a probe result blocks an online action, or null when it does not.
 *
 * 'closed' never blocks: a CODESYS runtime serves one gateway connection at
 * a time and drops any further one at once, so a healthy PLC that a gateway
 * is already talking to looks exactly like a stuck one (measured on a
 * WAGO PFC200 FW26 2026-10-17: 10 ms close while the application ran and
 * an IDE was logged in). It only means something already holds the slot.
 */
function probeVerdict(p) {
    switch (p.state) {
        case 'open':
        case 'closed':
            return null;
        case 'refused':
            return `Nothing listens at ${p.host}:${p.port}: the tunnel forwards to a PLC whose runtime is down, or the local end ` +
                `of the tunnel is not running. Check the tunnel, then the runtime on the PLC.`;
        case 'timeout':
        case 'error':
            return `Could not reach ${p.host}:${p.port} (${p.message}). Check the tunnel or the network path to the PLC.`;
    }
}
/** A hint for a known CODESYS login failure text, or null. */
function loginFailureHint(output) {
    const text = output ?? '';
    if (/An item with the same key has already been added/i.test(text)) {
        return 'CODESYS still holds part of an online session from earlier failed logins (typically after the PLC dropped ' +
            'or rebooted mid-session). Retrying in the same CODESYS gives the same error. Save the project, close CODESYS ' +
            '(shutdown_codesys for one this server started; ask the user to close one they opened) and retry in a fresh one.';
    }
    if (/Gateway not configured properly/i.test(text)) {
        return 'CODESYS got no session to the PLC through its gateway. Causes seen: the device has no address ' +
            '(rebind_device_to_scan_result), CODESYS lost its own connection to the gateway (Communication Settings: select ' +
            'the device address and press Enter), the runtime\'s single gateway slot is held by a dead connection after the PLC ' +
            'or tunnel dropped (reboot the PLC).';
    }
    if (/Stack empty/i.test(text)) {
        return '"Stack empty" from the online layer: a modal dialog is probably open in CODESYS (for example a network scan ' +
            'result); close it and retry. With a watcher older than 0.6.0 it is the timer-watcher bug instead: restart that CODESYS.';
    }
    if (/timed out after \d+\s*ms waiting for result/i.test(text)) {
        return 'The command timed out on the MCP side, but CODESYS may still be working on it. A full download over a slow ' +
            'link takes minutes, and the PLC logs one "Download successful" line per chunk every few seconds: that is a download ' +
            'in progress, not a loop. Do not kill CODESYS. Wait until the PLC log stops growing, then check the application state.';
    }
    if (/No active path/i.test(text)) {
        return 'The device has no active path: bind it with rebind_device_to_scan_result (matchAddress "host:port" for a tunnel).';
    }
    return null;
}
/**
 * IP bindings made with rebind_device_to_scan_result, per project. The
 * CODESYS script API sets an IP binding but cannot read it back
 * (get_address() is empty), so the server keeps its own record to probe.
 */
function ipBindingsFile() {
    const base = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(base, 'Codesys-MCP-Master', 'ip-bindings.json');
}
function bindingKey(projectPath) {
    return projectPath.replace(/^'|'$/g, '').replace(/\//g, '\\').toLowerCase();
}
function readBindings(file) {
    try {
        const v = JSON.parse(fs.readFileSync(file, 'utf-8'));
        return v && typeof v === 'object' ? v : {};
    }
    catch {
        return {};
    }
}
function rememberIpBinding(projectPath, address, file = ipBindingsFile()) {
    const all = readBindings(file);
    if (parseIpAddress(address))
        all[bindingKey(projectPath)] = address.trim();
    else
        delete all[bindingKey(projectPath)];
    try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify(all, null, 2));
    }
    catch {
        // A probe is a convenience; never fail a rebind over it.
    }
}
function ipBindingFor(projectPath, file = ipBindingsFile()) {
    return readBindings(file)[bindingKey(projectPath)] ?? null;
}
/**
 * Pre-login check for a project bound by IP. Blocks only when nothing takes
 * the TCP connection (tunnel or runtime down). An unknown binding checks
 * nothing: then the login itself has to tell.
 */
async function preLoginProbe(projectPath, file = ipBindingsFile()) {
    const addr = ipBindingFor(projectPath, file);
    const ip = addr ? parseIpAddress(addr) : null;
    if (!ip)
        return { block: null, note: null };
    const p = await probeRuntime(ip.host, ip.port);
    const verdict = probeVerdict(p);
    if (verdict) {
        return {
            block: `Pre-login check FAILED: ${verdict} (Checked ${addr}, the address this project was last bound to with ` +
                `rebind_device_to_scan_result. If the project now uses another binding, rebind it and this record follows.)`,
            note: null,
        };
    }
    if (p.state === 'closed') {
        return {
            block: null,
            note: `Runtime check: ${p.message}. A CODESYS runtime serves one gateway connection at a time, so this is normal ` +
                `while a gateway is logged in. If the login keeps failing although no CODESYS is online with this PLC, the slot is ` +
                `held by a dead connection (for example from before the PLC or tunnel dropped): list it on the PLC with ` +
                `"netstat -tn | grep ${ip.port}"; rebooting the PLC clears it.`,
        };
    }
    return { block: null, note: null };
}
/** The tool response for a failed online call, with the pre-login note in front when there is one. */
function withNote(text, check) {
    return check.note ? `${check.note}\n\n${text}` : text;
}
/** "An item with the same key has already been added": CODESYS keeps half an online session. */
function isStaleOnlineSession(output) {
    return /An item with the same key has already been added/i.test(output ?? '');
}
/** "Gateway not configured properly" in a login failure. */
function isGatewayNotConfigured(output) {
    return /Gateway not configured properly/i.test(output ?? '');
}
/** Established TCP connections of a process (PowerShell Get-NetTCPConnection); null when it cannot be read. */
const defaultTcpLister = (pid) => new Promise((resolve) => {
    if (process.platform !== 'win32')
        return resolve(null);
    const cmd = `Get-NetTCPConnection -OwningProcess ${Math.trunc(pid)} -ErrorAction SilentlyContinue | ` +
        `Select-Object RemotePort,@{n='State';e={[string]$_.State}} | ConvertTo-Json -Compress`;
    const child = (0, child_process_1.spawn)('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', cmd], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    const timer = setTimeout(() => { child.kill(); resolve(null); }, 15000);
    child.stdout.on('data', (d) => (out += d.toString()));
    child.on('error', () => { clearTimeout(timer); resolve(null); });
    child.on('close', () => {
        clearTimeout(timer);
        if (!out.trim())
            return resolve([]);
        try {
            const v = JSON.parse(out);
            const rows = Array.isArray(v) ? v : [v];
            resolve(rows.map((r) => ({ remotePort: Number(r.RemotePort), state: String(r.State) })));
        }
        catch {
            resolve(null);
        }
    });
});
exports.defaultTcpLister = defaultTcpLister;
/**
 * After "Gateway not configured properly": does this CODESYS have its own
 * connection to the gateway (default port 1217)? On 2026-10-17 it had none
 * after the PLC dropped; selecting the address in Communication Settings and
 * pressing Enter brought it back. Returns a sentence for the reply, or null.
 */
async function gatewayLinkNote(pid, list = exports.defaultTcpLister, gatewayPort = 1217) {
    if (pid === null)
        return null;
    const conns = await list(pid);
    if (conns === null)
        return null;
    const linked = conns.some((c) => c.remotePort === gatewayPort && /established/i.test(c.state));
    return linked
        ? `CODESYS (PID ${pid}) is connected to its gateway (port ${gatewayPort}), so the gateway reached no runtime: check the PLC side.`
        : `CODESYS (PID ${pid}) has no connection to its gateway (port ${gatewayPort}). In the device's Communication Settings ` +
            `select the device address and press Enter (that reconnected it on 2026-10-17), or restart that CODESYS; then retry.`;
}
const RECOVERY_WHY = {
    stale: 'CODESYS held a stale online session from earlier failed logins ("An item with the same key has already been added")',
    gateway: 'CODESYS had lost its own connection to the gateway ("Gateway not configured properly", no connection to port 1217)',
};
/**
 * Runs a login script and recovers once from the two stuck states only a
 * fresh CODESYS clears: a stale online session, and an IDE that lost its
 * gateway connection. Only a CODESYS this server started is closed, never
 * one the user opened; unsaved projects stop it with the usual question.
 */
async function runWithRecovery(deps) {
    const result = await deps.run();
    if (result.success && result.output.includes('SCRIPT_SUCCESS'))
        return { result, recovery: null };
    let why = null;
    if (isStaleOnlineSession(result.output))
        why = RECOVERY_WHY.stale;
    else if (isGatewayNotConfigured(result.output) && (await deps.gatewayLinked()) === false)
        why = RECOVERY_WHY.gateway;
    if (!why)
        return { result, recovery: null };
    const attached = deps.attached();
    if (attached === null)
        return { result, recovery: null };
    if (attached)
        return { result, recovery: `${why}. That CODESYS was opened by the user, so it was not closed: ASK THE USER to restart it.` };
    try {
        await deps.shutdown();
    }
    catch (err) {
        return { result, recovery: `${why}, and it was not restarted: ${err instanceof Error ? err.message : String(err)}` };
    }
    const done = `${why}. This server had started that CODESYS and it had no unsaved changes, so it was closed`;
    try {
        return { result: await deps.run(), recovery: `${done} and the call ran once more in a fresh one.` };
    }
    catch (err) {
        return { result, recovery: `${done}, but starting a fresh one failed: ${err instanceof Error ? err.message : String(err)}` };
    }
}
/** The gateway check as a yes/no: established connection from that process to the gateway port. */
async function hasGatewayLink(pid, list = exports.defaultTcpLister, gatewayPort = 1217) {
    if (pid === null)
        return null;
    const conns = await list(pid);
    if (conns === null)
        return null;
    return conns.some((c) => c.remotePort === gatewayPort && /established/i.test(c.state));
}
//# sourceMappingURL=online-diagnose.js.map