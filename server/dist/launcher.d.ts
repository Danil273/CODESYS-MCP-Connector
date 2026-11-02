/**
 * CODESYS launcher — spawns CODESYS with UI and watcher script,
 * tracks process lifecycle, delegates to IPC for command execution.
 */
import { LauncherConfig, LauncherStatus, CodesysState, IpcResult, ScriptExecutor } from './types';
export declare const SESSION_DIR_PREFIX = "codesys-mcp-sp21-plus";
export interface RunningCodesys {
    pid: number;
    exePath: string;
}
/**
 * Compare two Windows paths for equality. Case-insensitive; normalises
 * forward and back slashes; trims trailing separators.
 *
 * Exported so the launcher unit test can pin the matching behaviour.
 */
export declare function pathsEqual(a: string, b: string): boolean;
/** Injectable for tests: how running CODESYS processes and old sessions are found. */
export interface LauncherDeps {
    findRunning?: () => RunningCodesys[];
    /** Folder holding the per-session IPC dirs (default %TEMP%/codesys-mcp-sp21-plus). */
    sessionBaseDir?: string;
    /** Main window title of a PID (default: tasklist). */
    windowTitle?: (pid: number) => string;
}
/**
 * Session dirs the attach script makes inside a CODESYS the user opened by
 * hand ("attach-<CODESYS pid>-<time>"). Such a CODESYS is the user's: the
 * MCP never closes or kills it, it only stops its watcher (detach).
 */
export declare const ATTACH_SESSION_PREFIX = "attach-";
/**
 * What to do with other CODESYS of the install before a new one starts
 * (the user's answer, asked through the agent): leave them and start next
 * to them, close them (a normal window close, so CODESYS itself asks about
 * unsaved changes), or save their projects first (only where a watcher
 * runs in them) and then close them.
 */
export type OtherInstancesChoice = 'leave' | 'close' | 'save-and-close';
/** What shutdown does with unsaved projects: ask (refuse), save first, discard, or leave CODESYS open. */
export type UnsavedChoice = 'ask' | 'save' | 'discard' | 'keep-open';
/**
 * The launch or shutdown needs the user's answer first. The message lists
 * what was found and the options; the agent asks the user and calls again
 * with the chosen option.
 */
export declare class DecisionNeededError extends Error {
    code: string;
}
export interface LaunchOptions {
    killExisting?: boolean;
    otherInstances?: OtherInstancesChoice;
}
export declare function buildLaunchQuestion(profileName: string, infos: InstanceInfo[], answerWith?: string): string;
export interface InstanceInfo {
    pid: number;
    kind: 'opened by hand' | 'attached' | 'used by another live MCP session' | 'left by an ended MCP session';
    title: string;
    /** Open projects with their unsaved flag, read through the instance's watcher; null without one. */
    projects: Array<{
        path: string;
        dirty: boolean;
    }> | null;
    /** Unsaved changes: from the projects, else from the window title ("Name.project*"); null when unknown. */
    unsaved: boolean | null;
    /** Session dir of its watcher, if one answers for it. */
    dir: string | null;
}
export declare function parseProjectList(output: string): Array<{
    path: string;
    dirty: boolean;
}>;
/** CODESYS marks unsaved changes in its title: "Name.project* - CODESYS" (verified SP21 2026-10-06). */
export declare function titleShowsUnsaved(title: string): boolean;
export declare function formatInstances(infos: InstanceInfo[]): string;
export declare class CodesysLauncher implements ScriptExecutor {
    private config;
    private deps;
    /** True when the last launch() took over a running CODESYS instead of starting one. */
    lastLaunchAdopted: boolean;
    /** What happened to other CODESYS the user asked to close in the last launch. */
    lastCloseReport: string[];
    /** What the last shutdown did with orphans it was asked about. */
    lastShutdownReport: string[];
    private launchInFlight;
    /** The user chose to leave other CODESYS of the install running and start next to them. */
    private otherInstancesChoice;
    /** PIDs the last launch question named: a 'close' answer acts on these only. */
    private askedPids;
    private state;
    private pid;
    private sessionId;
    private ipcDir;
    private ipcClient;
    private process;
    private startedAt;
    private lastError;
    private healthInterval;
    private stateChangeCallbacks;
    constructor(config: LauncherConfig, deps?: LauncherDeps);
    /** Whether a process still runs (EPERM counts as running). */
    isPidAlive(pid: number): boolean;
    /** True when the current session is an attach session in a CODESYS the user opened. */
    get attached(): boolean;
    /** Mark this server as the session's owner, so a second live server never takes it over. */
    private writeOwner;
    /** PID of the MCP server that owns a session dir, if it is still alive and not us. */
    private liveForeignOwner;
    /**
     * Delete session dirs nothing can use any more, on every launch: the
     * CODESYS named in ready.signal is gone (or the dir has a terminate signal
     * and its CODESYS is gone), or a launch never wrote ready.signal and the
     * dir is older than a day. Dirs of a running CODESYS (any install) and of
     * a live foreign owner are kept.
     */
    private pruneSessionDirs;
    private sessionBaseDir;
    /**
     * Take over a CODESYS of this install that an earlier MCP session started
     * and left running. Its watcher (a UI-thread timer since 0.18.0) keeps
     * polling that session's IPC dir, so a new server can reuse the dir: find
     * the session whose ready.signal names one of the running PIDs, ping its
     * watcher, and adopt it if the ping comes back. Returns false when none
     * answers (a CODESYS opened by hand has no watcher and is adopted only after the user ran the attach script in it).
     */
    private tryAdopt;
    /**
     * Take over the watcher the attach script started in a CODESYS of this
     * install that the user opened by hand. Waits up to maxWaitMs for the
     * script to be run (Tools > Scripting > Execute Script File...). A session
     * this launcher already drives is left running: a CODESYS it started stays
     * open (a later launch can take it over again), an earlier attach session
     * is detached. Returns the CODESYS PID, or null when none turned up.
     */
    attach(maxWaitMs: number): Promise<number | null>;
    /**
     * CODESYS of this install that only the attach script can bring under the
     * MCP: opened by hand (no session dir names its PID), or attached once and
     * detached since (an attach session without a live watcher). Never the one
     * this launcher drives, nor one another live MCP session uses, nor one
     * whose watcher still answers (attach() or a launch takes that over).
     */
    attachCandidates(): RunningCodesys[];
    /** Window title of a CODESYS ('' when unknown). */
    titleOf(pid: number): string;
    /** Session dirs of running CODESYS (from `running`) that this launcher may take over, newest first. */
    private adoptableSessions;
    /** Ping a session's watcher and, when it answers, make it this launcher's session. */
    private adoptSession;
    /**
     * Stop an attach session's watcher. The CODESYS (and any project open in
     * it) is the user's and stays as it is. The dir keeps its terminate signal
     * until pruneSessionDirs removes it later: deleting it at once could beat
     * a watcher still busy with a command to the signal, and its timer would
     * then poll a missing dir forever.
     */
    private detachSession;
    /** Open projects of a CODESYS through a watcher's session dir; null when it does not answer. */
    private listProjectsVia;
    /**
     * Ask the user (through the agent) what happens to other CODESYS of the
     * install before one more starts, or act on their answer. Throws the
     * question when there is no answer yet. 'close' / 'save-and-close' act
     * only on the CODESYS the question named (one opened since then was never
     * shown to the user); 'leave' holds for the rest of this server's life.
     * Returns the CODESYS of the install still running.
     */
    private decideAboutOthers;
    /**
     * Who runs each CODESYS and whether it holds unsaved work: through its
     * watcher where one answers (left by an ended session, or attached), else
     * from the window title. Another live session's watcher is not used.
     */
    describeInstances(running: RunningCodesys[]): Promise<InstanceInfo[]>;
    /**
     * Close other CODESYS on the user's answer. Never one another live MCP
     * session drives. A normal window close (taskkill without /F): CODESYS
     * asks about unsaved changes itself and stays open until answered; it is
     * never forced. With save, unsaved projects are saved first through the
     * instance's watcher; one without a watcher cannot be saved from here.
     */
    closeInstances(infos: InstanceInfo[], save: boolean): Promise<string[]>;
    /**
     * Find CODESYS.exe instances using the same install path as our config.
     * Public so the server can decide whether to soft-fail vs. propagate.
     */
    findConflictingInstances(): RunningCodesys[];
    /**
     * Taskkill conflicting same-install CODESYS.exe processes. Returns the
     * PIDs that were killed. Used by launch({ killExisting: true }) and by
     * the launch_codesys MCP tool to resolve a conflict from chat.
     */
    /**
     * CODESYS PIDs a live MCP server other than this one is using: their
     * session dir's ready.signal names the PID and owner.json a live server.
     * killExisting never kills those; with several instances per install
     * allowed, another session's CODESYS is not an orphan.
     */
    private pidsOwnedByOtherServers;
    /**
     * CODESYS PIDs named by a session dir's ready.signal: whether an MCP
     * server started that CODESYS (a plain session dir) or the user opened it
     * and ran the attach script (attach-*), and whether another live server
     * uses it.
     */
    private sessionsByPid;
    /**
     * Same-install instances killExisting may kill: not used by another live
     * server, and not a CODESYS the user opened and attached (that one holds
     * the user's own work).
     */
    private findKillableInstances;
    /**
     * A CODESYS the MCP may kill: an MCP server started it (a plain session
     * dir names its PID) and no live server uses it. Never one the user opened
     * by hand (no session dir, or an attach session, also after a detach),
     * nor one another live session drives.
     */
    private isOrphan;
    killConflictingInstances(exclude?: Set<number>): number[];
    /** Launch CODESYS with UI and watcher script */
    /**
     * Launch, or take over a running CODESYS. Concurrent calls share one
     * attempt: the takeover ping runs before the state turns 'launching', so
     * without this two tool calls could both adopt (double health monitor) or
     * one could fail after the other succeeded.
     */
    launch(opts?: LaunchOptions): Promise<void>;
    private doLaunch;
    /** Graceful shutdown */
    /**
     * Shut CODESYS down. Unsaved projects are never thrown away unasked:
     * unsaved 'ask' (the default) refuses with a DecisionNeededError listing
     * them, 'save' saves them first, 'keep-open' leaves CODESYS open with them
     * (a later launch takes it over), 'discard' closes without saving.
     */
    shutdown(opts?: {
        unsaved?: UnsavedChoice;
    }): Promise<void>;
    /** Execute a script through the IPC channel */
    executeScript(content: string, timeoutMs?: number): Promise<IpcResult>;
    /**
     * A check that turns true once the CODESYS tracked now has exited: no
     * result can come any more. It holds on to the PID, because the exit
     * handler clears this.pid the moment CODESYS goes.
     */
    private goneCheck;
    /** Get current launcher status */
    getStatus(): LauncherStatus;
    /**
     * If the launcher is parked in 'error' state because a previous launch
     * refused due to a foreign CODESYS, re-probe the process table. If those
     * conflicting PIDs are now gone, transition back to 'stopped' and clear
     * lastError so the next status call / launch attempt sees a fresh state.
     *
     * Without this, getStatus() returned a frozen snapshot of state+lastError,
     * so once "Refusing to launch" was cached, even closing the foreign
     * CODESYS wouldn't update the status -- only an MCP restart would.
     * Distinct from the launch()-time guard at line ~145 (which already
     * re-probes) because users hit `get_codesys_status` first to figure out
     * what's wrong, and a stale "Refusing to launch" is misleading.
     */
    private revalidateLaunchRefusal;
    /** Check if the CODESYS process is still alive */
    isRunning(): boolean;
    /**
     * The spawn goes through a shell, so the PID we got back is cmd.exe, not
     * CODESYS. The watcher writes os.getpid() of CODESYS into ready.signal;
     * switch to that PID once it is confirmed to be a CODESYS.exe of our
     * install, so status, the health monitor and shutdown act on CODESYS itself.
     */
    private adoptCodesysPid;
    /** Register callback for state changes */
    onStateChange(callback: (state: CodesysState) => void): void;
    private setState;
    private startHealthMonitor;
    private stopHealthMonitor;
    private sleep;
}
//# sourceMappingURL=launcher.d.ts.map