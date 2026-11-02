"use strict";
/**
 * Python script template loading and interpolation.
 * Loads .py templates from src/scripts/ (or dist/scripts/) and performs
 * {PARAM} replacement. No caching: a tool call is ~1.5 s of CODESYS time,
 * so the few-ms cost of re-reading a small .py file each call is invisible
 * AND it means edits to dist/scripts/ are picked up live without an MCP
 * restart. This makes iterating on script-side fixes much faster
 * (relevant for the SP21+ scripting-engine drift bugs we hit on this fork).
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
exports.ScriptManager = void 0;
exports.rememberDeviceCredentials = rememberDeviceCredentials;
exports.rememberedDeviceUser = rememberedDeviceUser;
exports.rememberedDevicePassword = rememberedDevicePassword;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class ScriptManager {
    constructor(scriptsDir) {
        this.scriptsDir = scriptsDir ?? path.join(__dirname, 'scripts');
    }
    /** Synchronously read a template file. Re-reads on every call -- no cache. */
    loadTemplate(name) {
        const fileName = name.endsWith('.py') ? name : `${name}.py`;
        const filePath = path.join(this.scriptsDir, fileName);
        if (!fs.existsSync(filePath)) {
            throw new Error(`Script template not found: ${filePath}`);
        }
        return fs.readFileSync(filePath, 'utf-8');
    }
    /**
     * Replace {KEY} placeholders with values.
     * No automatic escaping — callers are responsible for escaping values
     * appropriate to their Python context (raw strings, triple-quoted strings, etc.).
     */
    interpolate(template, params) {
        let result = template;
        for (const [key, value] of Object.entries(params)) {
            const pattern = new RegExp(`\\{${key}\\}`, 'g');
            // Function replacement: a plain string here would interpret $-sequences
            // ($$, $&, ...) in the VALUE as regex replacement patterns, corrupting
            // IEC string literals like '$R$N' passed through tool params.
            result = result.replace(pattern, () => String(value));
        }
        return result;
    }
    /** Concatenate multiple script fragments with double newlines */
    combineScripts(...scripts) {
        return scripts.join('\n\n');
    }
    /** Load a template and interpolate parameters */
    prepareScript(name, params) {
        const template = this.loadTemplate(name);
        return this.interpolate(template, params);
    }
    /** Prepend helper scripts before the main script, then interpolate all */
    prepareScriptWithHelpers(name, params, helpers) {
        // Every script that goes online gets the device-credential helper, so a
        // PLC with user management never pops the Device User Logon dialog. Tools
        // with deviceUser/devicePassword args pass them; the rest use the
        // CODESYS_DEVICE_USER / CODESYS_DEVICE_PASSWORD env of the MCP server.
        let allHelpers = helpers;
        let allParams = params;
        if (helpers.includes('ensure_online_connection') && !helpers.includes('register_device_credentials')) {
            allHelpers = ['register_device_credentials', ...helpers];
        }
        if (allHelpers.includes('register_device_credentials')) {
            allParams = {
                ...params,
                DEVICE_USER: params.DEVICE_USER ?? pyLiteral(rememberedDeviceUser(params.PROJECT_FILE_PATH)),
                DEVICE_PASSWORD: params.DEVICE_PASSWORD ?? pyLiteral(rememberedDevicePassword(params.PROJECT_FILE_PATH)),
            };
        }
        const helperContents = allHelpers.map((h) => this.loadTemplate(h));
        const mainTemplate = this.loadTemplate(name);
        const combined = this.combineScripts(...helperContents, mainTemplate);
        return this.interpolate(combined, allParams);
    }
}
exports.ScriptManager = ScriptManager;
/** A Python string literal (double-quoted, JSON escapes are valid Python). */
function pyLiteral(v) {
    return JSON.stringify(v);
}
/**
 * Device credentials a tool call passed explicitly (connect_to_device,
 * download_to_device, ...), kept per project for the rest of the session so
 * the online tools without credential arguments (read/write variables,
 * start/stop, ...) log in with them instead of popping the Device User Logon
 * dialog. Per project, so one PLC's user is never sent to another.
 */
const sessionCredentials = new Map();
function credKey(projectPath) {
    return (projectPath ?? '').replace(/^'|'$/g, '').replace(/\//g, '\\').toLowerCase();
}
function rememberDeviceCredentials(user, password, projectPath) {
    if (user && password)
        sessionCredentials.set(credKey(projectPath), { user, password });
}
/**
 * Credentials for a project's PLC: those given earlier in this session for
 * that project, else CODESYS_DEVICE_USER / CODESYS_DEVICE_PASSWORD from the
 * MCP server environment (an empty variable counts as unset), else ''.
 */
function rememberedDeviceUser(projectPath) {
    return sessionCredentials.get(credKey(projectPath))?.user || process.env.CODESYS_DEVICE_USER || '';
}
function rememberedDevicePassword(projectPath) {
    return sessionCredentials.get(credKey(projectPath))?.password || process.env.CODESYS_DEVICE_PASSWORD || '';
}
//# sourceMappingURL=script-manager.js.map