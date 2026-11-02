/**
 * Headless fallback mode — spawns CODESYS with --noUI per command.
 * Direct port of the original codesys_interop.js approach.
 */
import { LauncherConfig, IpcResult, ScriptExecutor } from './types';
export declare class HeadlessExecutor implements ScriptExecutor {
    private config;
    constructor(config: LauncherConfig);
    /** Execute a script by spawning CODESYS with --noUI */
    executeScript(scriptContent: string, timeoutMs?: number): Promise<IpcResult>;
}
//# sourceMappingURL=headless.d.ts.map