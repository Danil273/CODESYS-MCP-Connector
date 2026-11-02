/**
 * Restart the CODESYS Control runtime on a Linux PLC over SSH.
 *
 * WHY THIS EXISTS: an unlicensed CODESYS Control runtime (Raspberry Pi
 * etc.) drops out of demo mode every 2 hours - systemctl still reports
 * the service as "active" even though the binary has died, so a port
 * check on 11740 is the real liveness signal. This tool gives the MCP a
 * one-call path to bring it back without dropping into a terminal.
 *
 * TWO WAYS IN:
 *   - Password auth (ssh2, pure JS): the Pi, whose sshd 10.x rejects
 *     pubkey signatures from this environment in practice; the sudo
 *     password is fed to `sudo -S`. Used when a password is given, and
 *     for the default host.
 *   - Key auth (the system `ssh`): any other host given without a
 *     password. Host may be an ~/.ssh/config alias, so a ProxyJump route
 *     works (PLCs behind a jump host); sudo runs as `sudo -n`.
 *
 * HOW THE RUNTIME IS RESTARTED, in order: the systemd unit `service` if
 * systemd knows it; else `/etc/init.d/<service>` stop + start; else, with
 * the default service name only, WAGO's `/etc/init.d/runtime` stop + start
 * (PFC200/CC100 have no systemd, and their init script has no `restart`;
 * verified on a lab PFC200 2026-10-06). As root no sudo is used.
 */
export interface RestartRuntimeOptions {
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    sudoPassword?: string;
    service?: string;
    /** 'password' (ssh2) or 'key' (system ssh). Default: password when a password is given or the host is the default Pi, else key. */
    auth?: 'password' | 'key';
    /** Seconds to wait for socket-listening on portCheck after restart. 0 = skip liveness check. */
    livenessWaitSeconds?: number;
    /** TCP port to probe for liveness after restart. Defaults to 11740 (CODESYS gateway). */
    livenessPort?: number;
    /** Connection timeout for the SSH handshake itself, ms. */
    connectTimeoutMs?: number;
}
export interface RestartRuntimeResult {
    host: string;
    user: string;
    service: string;
    auth: 'password' | 'key';
    /** What was run on the PLC, e.g. "systemctl restart codesyscontrol" or "/etc/init.d/runtime stop+start". Empty if nothing matched. */
    method: string;
    /** Exit code of the restart. 0 = restart issued cleanly. */
    restartExitCode: number;
    restartStdout: string;
    restartStderr: string;
    /** True if the runtime was confirmed listening on livenessPort after restart. null if liveness skipped. */
    listening: boolean | null;
    /** Seconds we waited before the liveness probe succeeded (or gave up). */
    livenessElapsedSeconds: number;
    /** Output of the post-restart listen probe (empty if not listening). */
    livenessProbeOutput: string;
}
/**
 * The remote shell command. The restart script runs as root: directly
 * when the login is root, else under sudo (`-S` reads the password from
 * stdin, `-n` fails at once instead of prompting). It names the method it
 * picked on stderr, and exits 4 when no way to restart `service` exists.
 */
export declare function buildRestartCommand(service: string, opts: {
    wagoFallback: boolean;
    sudo: 'stdin' | 'noninteractive';
}): string;
/** Port probe that works with iproute2 (`ss`) and with BusyBox/net-tools (`netstat`). */
export declare function buildListenProbe(port: number): string;
export declare function restartCodesysRuntime(options?: RestartRuntimeOptions): Promise<RestartRuntimeResult>;
export declare function formatRestartRuntimeResult(res: RestartRuntimeResult): string;
//# sourceMappingURL=ssh-restart-runtime.d.ts.map