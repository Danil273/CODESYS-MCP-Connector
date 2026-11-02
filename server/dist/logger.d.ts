/**
 * Structured stderr logging with levels.
 * MCP uses stdout for protocol, so all logs go to stderr.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export declare function setLogLevel(level: LogLevel): void;
export declare function getLogLevel(): LogLevel;
export declare const ipcLog: {
    debug(message: string): void;
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
};
export declare const launcherLog: {
    debug(message: string): void;
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
};
export declare const serverLog: {
    debug(message: string): void;
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
};
export declare const watcherLog: {
    debug(message: string): void;
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
};
export declare const headlessLog: {
    debug(message: string): void;
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
};
//# sourceMappingURL=logger.d.ts.map