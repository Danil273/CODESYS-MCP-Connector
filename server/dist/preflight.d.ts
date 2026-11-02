/**
 * Pre-flight check for `open_project`.
 *
 * WHY: When the user calls `open_project` with a .project file saved on a
 * different SP than the configured CODESYS install, CODESYS pops a modal
 * dialog (patch difference) or flat-out refuses (SP difference). Either
 * way it blocks the IPC pipe and every subsequent script call hangs.
 *
 * This module compares the project's saved profile (read offline via
 * src/inspect.ts -- ZIP+XML, no CODESYS) against the server's configured
 * --codesys-profile and decides one of three outcomes BEFORE the open
 * script is dispatched:
 *
 *   - exact match           -> proceed silently
 *   - same SP, diff patch   -> proceed but warn (CODESYS will pop the
 *                              patch-difference dialog; the user knows)
 *   - SP mismatch           -> refuse outright with a routing hint to
 *                              regenerate config via `--print-config
 *                              --for-project <path>`
 *
 * If inspection or profile parsing fails for any reason, the caller is
 * expected to fall through silently and let CODESYS produce its native
 * error -- pre-flight is a UX nicety, not a hard dependency.
 */
export interface PreflightDecision {
    action: 'proceed' | 'proceed-with-warning' | 'refuse';
    /** Populated for 'proceed-with-warning' and 'refuse'. */
    message?: string;
}
export interface PreflightProjectInspection {
    sp: number;
    patch: number;
    profileName: string;
    profileVersion: string;
}
export interface PreflightServerProfile {
    sp: number;
    patch: number;
}
export declare function decideOpenProjectPreflight(projectInspection: PreflightProjectInspection, serverProfile: PreflightServerProfile, projectFilePath: string): PreflightDecision;
//# sourceMappingURL=preflight.d.ts.map