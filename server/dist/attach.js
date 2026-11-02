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
exports.buildAttachScript = buildAttachScript;
exports.defaultAttachScriptPath = defaultAttachScriptPath;
exports.writeAttachScript = writeAttachScript;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const script_manager_1 = require("./script-manager");
const launcher_1 = require("./launcher");
/**
 * The attach script: the MCP watcher, for a CODESYS the user opened by hand.
 *
 * A CODESYS the MCP did not start has no watcher, so the MCP cannot drive
 * it. Running this script once in it (Tools > Scripting > Execute Script
 * File...) installs the same UI-thread timer the launcher's --runscript
 * installs, in a new session dir "attach-<pid>-<time>" under the MCP's
 * session folder; the script returns and the timer keeps polling. The MCP
 * then takes that session over like one an ended session left (verified on
 * SP21 2026-10-06: run through CommandHelper.ExecuteScript, the call behind
 * Execute Script File, the attach session answered after the script had
 * returned).
 *
 * The session folder comes from the TEMP path CODESYS sees, which is the
 * one the MCP server uses (same user).
 */
function buildAttachScript(sessionFolderName) {
    const template = new script_manager_1.ScriptManager().loadTemplate('watcher');
    const line = 'IPC_BASE_DIR = r"{IPC_BASE_DIR}"';
    if (!template.includes(line)) {
        throw new Error('watcher.py no longer has the IPC_BASE_DIR line the attach script replaces');
    }
    const replacement = [
        '# Attach script: this session dir is made here, inside the CODESYS the',
        '# user opened, under the MCP server\'s session folder. TEMP first, the',
        '# way Node\'s os.tmpdir() reads it (.NET GetTempPath reads TMP first).',
        'import System as _AttachSystem',
        '_attach_tmp = os.environ.get("TEMP") or os.environ.get("TMP") or _AttachSystem.IO.Path.GetTempPath()',
        `_attach_base = os.path.join(_attach_tmp, "${sessionFolderName}")`,
        `_attach_prefix = "${launcher_1.ATTACH_SESSION_PREFIX}%d-" % os.getpid()`,
        '# Run twice in one CODESYS: stop the earlier attach watcher first.',
        'if os.path.isdir(_attach_base):',
        '    for _old in os.listdir(_attach_base):',
        '        if _old.startswith(_attach_prefix):',
        '            try:',
        '                open(os.path.join(_attach_base, _old, "terminate.signal"), "w").close()',
        '            except Exception:',
        '                pass',
        'IPC_BASE_DIR = os.path.join(_attach_base, _attach_prefix + str(int(time.time())))',
        'if not os.path.isdir(IPC_BASE_DIR):',
        '    os.makedirs(IPC_BASE_DIR)',
    ].join('\n');
    return template.replace(line, replacement);
}
/**
 * Where attach_codesys writes the script: a fixed path the user can pick in the file dialog.
 *
 * Under TEMP, not LOCALAPPDATA: a server started by an MSIX-packaged client
 * (the Claude desktop app) has its LOCALAPPDATA writes redirected into
 * Packages\<package>\LocalCache\Local, which CODESYS does not see, so the
 * automatic attach failed at step 'open' (2026-10-30..11-02). TEMP is not
 * redirected; the session folders already live there.
 */
function defaultAttachScriptPath() {
    return path.join(os.tmpdir(), 'Codesys-MCP-Master', 'attach-codesys-mcp.py');
}
function writeAttachScript(sessionFolderName, target = defaultAttachScriptPath()) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, buildAttachScript(sessionFolderName), 'utf-8');
    return target;
}
//# sourceMappingURL=attach.js.map