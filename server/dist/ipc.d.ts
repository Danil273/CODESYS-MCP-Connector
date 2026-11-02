/**
 * File-based IPC transport layer.
 * Writes command files, polls for result files, with command serialization.
 */
import { IpcConfig, IpcResult } from './types';
/** Default IPC configuration */
/**
 * Python put in front of every script. A script calls mcp_progress('stage')
 * when it reaches a new stage; every call appends a line to the progress
 * file, and the wait for the result starts its timeout again from there.
 * So a timeout measures how long a script has been silent, not how long
 * it has run: a download that spent 8 of its 10 minutes opening, building
 * and logging in no longer runs out of time during the transfer itself
 * (2026-10-18). Valid in IronPython 2.7 and CPython 3.
 */
export declare function progressPreamble(progressFile: string): string;
/** Last stage line of a progress file ('' when there is none). */
export declare function lastProgressStage(progressFile: string): string;
export declare const DEFAULT_IPC_CONFIG: Omit<IpcConfig, 'baseDir'>;
export declare class IpcClient {
    private config;
    private mutex;
    private commandsDir;
    private resultsDir;
    constructor(config: IpcConfig);
    /** Create commands/ and results/ directories */
    ensureDirectories(): Promise<void>;
    /** Check if the watcher has written ready.signal */
    isReady(): Promise<boolean>;
    /** Write terminate.signal to request watcher shutdown */
    sendTerminate(): Promise<void>;
    /**
     * Send a command to the watcher and wait for result.
     * Serialized via async mutex — only one command in-flight at a time.
     */
    /**
     * opts.abortWhen is checked on every poll: when it turns true (the CODESYS
     * process is gone) the wait ends at once instead of running out the
     * timeout, which has a 180 s floor.
     */
    sendCommand(scriptContent: string, timeoutMs?: number, opts?: {
        abortWhen?: () => boolean;
    }): Promise<IpcResult>;
    private _sendCommandInternal;
    /**
     * Read result file with retry for corrupted/partial JSON.
     * Up to 3 attempts with 100ms delay between.
     */
    private _readResultWithRetry;
    /** Clean up command files for a given request */
    private _cleanupCommandFiles;
    /** Remove the entire session directory */
    cleanup(): Promise<void>;
    private _sleep;
}
//# sourceMappingURL=ipc.d.ts.map