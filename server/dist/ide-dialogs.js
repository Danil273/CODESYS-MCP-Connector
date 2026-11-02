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
exports.defaultDialogRunner = exports.AUTO_ANSWER = void 0;
exports.planDialogs = planDialogs;
exports.dialogHelperPath = dialogHelperPath;
exports.listDialogs = listDialogs;
exports.clearIdeDialogs = clearIdeDialogs;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
exports.AUTO_ANSWER = [
    {
        match: /No device is responding to the scan request/i,
        button: 'OK',
        why: 'result of a network scan; OK only closes it',
    },
    {
        match: /No connection to the device\.?\s*Please rescan your network/i,
        button: 'OK',
        why: 'report of a lost connection; OK only closes it',
    },
    {
        match: /No active path defined\.\s*Do you want to set it\?/i,
        button: 'Cancel',
        why: "Cancel returns without action; Yes would start a scan that cannot see a PLC behind a tunnel",
    },
];
function planDialogs(dialogs, rules = exports.AUTO_ANSWER) {
    const plan = { answer: [], blocking: [] };
    for (const d of dialogs) {
        const rule = rules.find((r) => r.match.test(d.text) && d.buttons.includes(r.button));
        if (rule)
            plan.answer.push({ dialog: d, rule });
        else
            plan.blocking.push(d);
    }
    return plan;
}
function dialogHelperPath() {
    return path.join(__dirname, 'scripts', 'ide_dialogs.ps1');
}
const defaultDialogRunner = (args, timeoutMs) => new Promise((resolve) => {
    const child = (0, child_process_1.spawn)('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', dialogHelperPath(), ...args], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    const timer = setTimeout(() => {
        stderr += `\ndialog helper timed out after ${Math.round(timeoutMs / 1000)} s`;
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
exports.defaultDialogRunner = defaultDialogRunner;
function lastJsonLine(stdout) {
    const line = stdout.trim().split(/\r?\n/).filter((l) => l.trim().startsWith('{')).pop();
    if (!line)
        return null;
    try {
        return JSON.parse(line);
    }
    catch {
        return null;
    }
}
async function listDialogs(pid, run = exports.defaultDialogRunner) {
    const r = await run(['-TargetPid', String(pid)], 15000);
    const j = lastJsonLine(r.stdout);
    if (!j || !Array.isArray(j.dialogs))
        return null;
    return j.dialogs.map((d) => ({
        hwnd: Number(d.hwnd),
        title: String(d.title ?? ''),
        text: String(d.text ?? ''),
        buttons: Array.isArray(d.buttons) ? d.buttons.map(String) : d.buttons ? [String(d.buttons)] : [],
    }));
}
/**
 * Before an online call: answer the harmless boxes, refuse on any other.
 * A helper failure never blocks (the call then runs as before).
 */
async function clearIdeDialogs(pid, run = exports.defaultDialogRunner) {
    if (pid === null || process.platform !== 'win32')
        return { block: null, answered: [] };
    const dialogs = await listDialogs(pid, run);
    if (!dialogs || dialogs.length === 0)
        return { block: null, answered: [] };
    const plan = planDialogs(dialogs);
    const answered = [];
    for (const { dialog, rule } of plan.answer) {
        const r = await run(['-TargetPid', String(pid), '-Hwnd', String(dialog.hwnd), '-Button', rule.button], 15000);
        const j = lastJsonLine(r.stdout);
        if (j?.ok)
            answered.push(`Closed a CODESYS box with ${rule.button} (${rule.why}): "${oneLine(dialog.text)}"`);
        else
            plan.blocking.push(dialog);
    }
    if (plan.blocking.length === 0)
        return { block: null, answered };
    const list = plan.blocking
        .map((d) => `  - "${oneLine(d.text) || d.title}" [buttons: ${d.buttons.join(', ') || 'none'}]`)
        .join('\n');
    return {
        block: `CODESYS (PID ${pid}) has a dialog open that blocks every script, so the online call did not start:\n${list}\n` +
            `ASK THE USER which button to press (or to close it), then retry.`,
        answered,
    };
}
function oneLine(s) {
    return s.replace(/\s+/g, ' ').trim();
}
//# sourceMappingURL=ide-dialogs.js.map