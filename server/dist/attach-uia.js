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
exports.defaultHelperRunner = void 0;
exports.attachHelperPath = attachHelperPath;
exports.parseHelperOutput = parseHelperOutput;
exports.runAttachAutomation = runAttachAutomation;
exports.describeAutomation = describeAutomation;
exports.autoAttach = autoAttach;
exports.formatCandidates = formatCandidates;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
function attachHelperPath() {
    return path.join(__dirname, 'scripts', 'attach_uia.ps1');
}
const defaultHelperRunner = (args, timeoutMs) => new Promise((resolve) => {
    const child = (0, child_process_1.spawn)('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', attachHelperPath(), ...args], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    const timer = setTimeout(() => {
        stderr += `\nattach helper timed out after ${Math.round(timeoutMs / 1000)} s`;
        child.kill();
    }, timeoutMs);
    child.on('error', (e) => {
        clearTimeout(timer);
        resolve({ code: null, stdout, stderr: `${stderr}\n${e.message}` });
    });
    child.on('close', (code) => {
        clearTimeout(timer);
        resolve({ code, stdout, stderr });
    });
});
exports.defaultHelperRunner = defaultHelperRunner;
/** The helper prints one JSON line; anything else is a failure with the raw output in the message. */
function parseHelperOutput(run) {
    const lines = run.stdout.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith('{'));
    for (let i = lines.length - 1; i >= 0; i--) {
        try {
            const o = JSON.parse(lines[i]);
            if (typeof o?.ok === 'boolean' && typeof o?.stage === 'string') {
                return {
                    ok: o.ok,
                    stage: o.stage,
                    message: typeof o.message === 'string' ? o.message : '',
                    title: typeof o.title === 'string' ? o.title : '',
                    matchedBy: Array.isArray(o.matchedBy) ? o.matchedBy.map(String) : [],
                    menu: Array.isArray(o.menu) ? o.menu.map(String) : [],
                };
            }
        }
        catch {
            // not the result line
        }
    }
    const raw = `${run.stdout}\n${run.stderr}`.trim().slice(-500);
    return {
        ok: false,
        stage: 'helper',
        message: `The attach helper gave no result (exit ${run.code ?? 'none'})${raw ? `: ${raw}` : ''}`,
        title: '',
        matchedBy: [],
        menu: [],
    };
}
/** Run the attach script in the CODESYS with this PID (and no other). */
async function runAttachAutomation(pid, scriptPath, opts = {}) {
    const fail = (stage, message) => ({ ok: false, stage, message, title: '', matchedBy: [], menu: [] });
    if ((opts.platform ?? process.platform) !== 'win32')
        return fail('platform', 'Automatic attach needs Windows.');
    if (!Number.isInteger(pid) || pid <= 0)
        return fail('process', `Invalid CODESYS PID ${pid}.`);
    const timeoutSeconds = Math.max(5, Math.round(opts.timeoutSeconds ?? 60));
    const args = ['-TargetPid', String(pid), '-TimeoutSeconds', String(timeoutSeconds)];
    if (opts.probeOnly)
        args.push('-ProbeOnly');
    else
        args.push('-ScriptPath', scriptPath);
    // Helper start (C# compile ~2 s) + menu + dialog (up to ~35 s) + the title wait.
    const run = await (opts.runner ?? exports.defaultHelperRunner)(args, (timeoutSeconds + 60) * 1000);
    return parseHelperOutput(run);
}
/** One line for a tool reply. */
function describeAutomation(r) {
    return r.ok ? r.message : `automatic attach failed at step '${r.stage}': ${r.message}`;
}
/**
 * Decide which CODESYS to attach automatically, run the helper on that one
 * only, and take over the session it made. Never guesses between several
 * CODESYS: the user picks (pid).
 */
async function autoAttach(d) {
    let target;
    if (d.pid !== undefined) {
        target = d.candidates.find((c) => c.pid === d.pid);
        if (!target)
            return { kind: 'not-candidate', pid: d.pid, candidates: d.candidates };
    }
    else if (d.candidates.length === 1) {
        target = d.candidates[0];
    }
    else if (d.candidates.length > 1) {
        return { kind: 'choose', candidates: d.candidates };
    }
    else {
        return { kind: 'none' };
    }
    const automation = await d.automate(target.pid);
    if (!automation.ok)
        return { kind: 'failed', pid: target.pid, label: target.label, automation };
    const pid = await d.pickUp(target);
    if (pid === null) {
        return {
            kind: 'failed',
            pid: target.pid,
            label: target.label,
            automation: {
                ...automation,
                ok: false,
                stage: 'pickup',
                message: automation.stage === 'already'
                    ? `${automation.message} Its watcher is not one this server may take over (another live MCP session drives it, or it is still starting).`
                    : `${automation.message} But no attach session of CODESYS PID ${target.pid} answered the MCP afterwards.`,
            },
        };
    }
    return { kind: 'attached', pid, label: target.label, automation };
}
function formatCandidates(cs) {
    return cs.map((c) => `  - PID ${c.pid} (${c.label}): ${c.title || '(no title)'}`).join('\n');
}
//# sourceMappingURL=attach-uia.js.map