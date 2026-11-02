/**
 * Online diagnostics: tell a dead PLC runtime apart from a stuck IDE.
 *
 * A device bound by IP (set_gateway_and_ip_address, e.g. an SSH tunnel at
 * 127.0.0.1:11740) cannot be checked with a network scan, so every login
 * problem showed up as one of three CODESYS messages that point the wrong
 * way. Seen on a PLC behind a tunnel on 2026-10-17, after a firmware restore
 * from the web page:
 *
 *  - "Gateway not configured properly": the gateway got no session to the
 *    runtime. The runtime closed every new TCP connection at once, most
 *    likely because a dead one still held its single gateway slot; a PLC
 *    reboot fixed it.
 *  - "An item with the same key has already been added": CODESYS kept half
 *    an online session from the failed logins. Only a CODESYS restart
 *    cleared it.
 *  - "Stack empty" from create_online_application: a modal dialog (a
 *    network scan result) was open in the IDE.
 *
 * probeRuntime() checks the runtime with a plain TCP connection that sends
 * nothing. A free runtime keeps it open and waits for the client to speak;
 * a runtime whose gateway slot is taken closes it at once (see probeVerdict);
 * a refused or timed out connection means the tunnel or the runtime is down.
 */
export type ProbeState = 'open' | 'closed' | 'refused' | 'timeout' | 'error';
export interface ProbeResult {
    state: ProbeState;
    host: string;
    port: number;
    /** For 'closed': milliseconds between connect and the far side closing. */
    closedAfterMs?: number;
    message: string;
}
/** 'host[:port]' as rebind_device_to_scan_result takes it; null if not an IP form. */
export declare function parseIpAddress(addr: string, defaultPort?: number): {
    host: string;
    port: number;
} | null;
export declare function probeRuntime(host: string, port: number, holdMs?: number, connectMs?: number): Promise<ProbeResult>;
/**
 * Why a probe result blocks an online action, or null when it does not.
 *
 * 'closed' never blocks: a CODESYS runtime serves one gateway connection at
 * a time and drops any further one at once, so a healthy PLC that a gateway
 * is already talking to looks exactly like a stuck one (measured on a
 * WAGO PFC200 FW26 2026-10-17: 10 ms close while the application ran and
 * an IDE was logged in). It only means something already holds the slot.
 */
export declare function probeVerdict(p: ProbeResult): string | null;
/** A hint for a known CODESYS login failure text, or null. */
export declare function loginFailureHint(output: string): string | null;
/**
 * IP bindings made with rebind_device_to_scan_result, per project. The
 * CODESYS script API sets an IP binding but cannot read it back
 * (get_address() is empty), so the server keeps its own record to probe.
 */
export declare function ipBindingsFile(): string;
export declare function rememberIpBinding(projectPath: string, address: string, file?: string): void;
export declare function ipBindingFor(projectPath: string, file?: string): string | null;
export interface PreLoginCheck {
    /** Set when the login cannot work: the call stops with this message. */
    block: string | null;
    /** Context to show only if the login then fails. */
    note: string | null;
}
/**
 * Pre-login check for a project bound by IP. Blocks only when nothing takes
 * the TCP connection (tunnel or runtime down). An unknown binding checks
 * nothing: then the login itself has to tell.
 */
export declare function preLoginProbe(projectPath: string, file?: string): Promise<PreLoginCheck>;
/** The tool response for a failed online call, with the pre-login note in front when there is one. */
export declare function withNote(text: string, check: PreLoginCheck): string;
/** "An item with the same key has already been added": CODESYS keeps half an online session. */
export declare function isStaleOnlineSession(output: string): boolean;
/** "Gateway not configured properly" in a login failure. */
export declare function isGatewayNotConfigured(output: string): boolean;
export type TcpLister = (pid: number) => Promise<Array<{
    remotePort: number;
    state: string;
}> | null>;
/** Established TCP connections of a process (PowerShell Get-NetTCPConnection); null when it cannot be read. */
export declare const defaultTcpLister: TcpLister;
/**
 * After "Gateway not configured properly": does this CODESYS have its own
 * connection to the gateway (default port 1217)? On 2026-10-17 it had none
 * after the PLC dropped; selecting the address in Communication Settings and
 * pressing Enter brought it back. Returns a sentence for the reply, or null.
 */
export declare function gatewayLinkNote(pid: number | null, list?: TcpLister, gatewayPort?: number): Promise<string | null>;
export interface ScriptRun {
    success: boolean;
    output: string;
    error?: string;
}
export interface RecoveryDeps<R extends ScriptRun> {
    run: () => Promise<R>;
    /** null when this server did not start a CODESYS for the call; true when the user opened it. */
    attached: () => boolean | null;
    /** Closes that CODESYS; throws (DecisionNeededError) when projects are unsaved. */
    shutdown: () => Promise<void>;
    /** Does that CODESYS have its own gateway connection? null when unknown. */
    gatewayLinked: () => Promise<boolean | null>;
}
/**
 * Runs a login script and recovers once from the two stuck states only a
 * fresh CODESYS clears: a stale online session, and an IDE that lost its
 * gateway connection. Only a CODESYS this server started is closed, never
 * one the user opened; unsaved projects stop it with the usual question.
 */
export declare function runWithRecovery<R extends ScriptRun>(deps: RecoveryDeps<R>): Promise<{
    result: R;
    recovery: string | null;
}>;
/** The gateway check as a yes/no: established connection from that process to the gateway port. */
export declare function hasGatewayLink(pid: number | null, list?: TcpLister, gatewayPort?: number): Promise<boolean | null>;
//# sourceMappingURL=online-diagnose.d.ts.map