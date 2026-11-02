/**
 * Read the running PLC's project version over SSH, bypassing the CODESYS
 * IDE entirely.
 *
 * WHY: read_running_version_online needs CODESYS open + the .project file
 * unlocked + the device-online protocol reachable. When any of those is
 * absent (project file held by another CODESYS instance, no CODESYS
 * install on this machine, online protocol blocked), the only remaining
 * path to the running version is the boot-application binary on disk on
 * the PLC itself. The X.Y.Z.W literal of `_MCP_PROJECT_VERSION.sVersion`
 * is baked into that binary by the compiler; its printable strings
 * carry it.
 *
 * The CODESYS V3.5 SP-runtime version (e.g. 3.5.22.0) is also baked in
 * by the same toolchain; we filter `3.5.*` out so the caller gets just
 * the project-version literal.
 *
 * Implementation choices:
 *   - Spawn the system `ssh` binary instead of pulling in `ssh2` /
 *     `node-ssh` - zero new npm deps and the user already has ssh
 *     keys configured for the PLC anyway.
 *   - `BatchMode=yes` so the call fails fast when keys aren't installed
 *     instead of hanging on a password prompt.
 *   - `sudo -n` for the same reason - non-interactive; clear failure
 *     when NOPASSWD sudo isn't configured for `cat`. As root (WAGO
 *     PFC200/CC100) no sudo is used.
 *   - The boot app is fetched and its strings picked here, so the PLC
 *     needs nothing beyond `cat` (WAGO BusyBox has no `strings`).
 */
export interface SshVersionResult {
    host: string;
    user: string;
    bootAppPath: string;
    projectVersion: string | null;
    candidates: string[];
    runtimeVersionLiterals: string[];
}
export interface SshVersionOptions {
    host: string;
    user?: string;
    bootAppPath?: string;
}
/**
 * Pure parser, factored out so unit tests can exercise the filter logic
 * without spawning ssh. Splits stdout on newlines, trims, drops blanks
 * and non-X.Y.Z.W tokens, separates 3.5.* (CODESYS SP-runtime) from
 * everything else, and decides whether a unique project-version
 * candidate emerged.
 */
export declare function parseSshOutput(stdout: string): {
    candidates: string[];
    projectVersion: string | null;
    runtimeVersionLiterals: string[];
};
/**
 * The printable runs of a binary, one per line, the way `strings` prints
 * them (runs of at least 4 printable ASCII characters). Done here rather
 * than on the PLC because PLC firmware often lacks `strings`: WAGO's
 * BusyBox has neither it nor a `tr` that understands [:print:].
 */
export declare function extractPrintableStrings(buf: Buffer, minLength?: number): string;
/**
 * The remote shell command: pick the boot app (the given path, or the
 * first of BOOT_APP_SEARCH that exists), name it on stderr and stream it
 * to stdout, as root directly or through non-interactive sudo.
 */
export declare function buildRemoteCommand(bootAppPath: string | undefined): string;
export declare function readRunningVersionSsh(opts: SshVersionOptions): Promise<SshVersionResult>;
/**
 * Format a SshVersionResult for human-readable output (CLI + MCP tool).
 * Shared so both surfaces emit identical text.
 */
export declare function formatSshVersionResult(res: SshVersionResult): string;
//# sourceMappingURL=ssh-version.d.ts.map