/**
 * Python script template loading and interpolation.
 * Loads .py templates from src/scripts/ (or dist/scripts/) and performs
 * {PARAM} replacement. No caching: a tool call is ~1.5 s of CODESYS time,
 * so the few-ms cost of re-reading a small .py file each call is invisible
 * AND it means edits to dist/scripts/ are picked up live without an MCP
 * restart. This makes iterating on script-side fixes much faster
 * (relevant for the SP21+ scripting-engine drift bugs we hit on this fork).
 */
import { ScriptParams } from './types';
export declare class ScriptManager {
    private scriptsDir;
    constructor(scriptsDir?: string);
    /** Synchronously read a template file. Re-reads on every call -- no cache. */
    loadTemplate(name: string): string;
    /**
     * Replace {KEY} placeholders with values.
     * No automatic escaping — callers are responsible for escaping values
     * appropriate to their Python context (raw strings, triple-quoted strings, etc.).
     */
    interpolate(template: string, params: ScriptParams): string;
    /** Concatenate multiple script fragments with double newlines */
    combineScripts(...scripts: string[]): string;
    /** Load a template and interpolate parameters */
    prepareScript(name: string, params: ScriptParams): string;
    /** Prepend helper scripts before the main script, then interpolate all */
    prepareScriptWithHelpers(name: string, params: ScriptParams, helpers: string[]): string;
}
export declare function rememberDeviceCredentials(user: string | undefined, password: string | undefined, projectPath?: string): void;
/**
 * Credentials for a project's PLC: those given earlier in this session for
 * that project, else CODESYS_DEVICE_USER / CODESYS_DEVICE_PASSWORD from the
 * MCP server environment (an empty variable counts as unset), else ''.
 */
export declare function rememberedDeviceUser(projectPath?: string): string;
export declare function rememberedDevicePassword(projectPath?: string): string;
//# sourceMappingURL=script-manager.d.ts.map