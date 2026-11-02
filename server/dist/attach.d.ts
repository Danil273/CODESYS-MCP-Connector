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
export declare function buildAttachScript(sessionFolderName: string): string;
/**
 * Where attach_codesys writes the script: a fixed path the user can pick in the file dialog.
 *
 * Under TEMP, not LOCALAPPDATA: a server started by an MSIX-packaged client
 * (the Claude desktop app) has its LOCALAPPDATA writes redirected into
 * Packages\<package>\LocalCache\Local, which CODESYS does not see, so the
 * automatic attach failed at step 'open' (2026-10-30..11-02). TEMP is not
 * redirected; the session folders already live there.
 */
export declare function defaultAttachScriptPath(): string;
export declare function writeAttachScript(sessionFolderName: string, target?: string): string;
//# sourceMappingURL=attach.d.ts.map