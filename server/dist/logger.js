"use strict";
/**
 * Structured stderr logging with levels.
 * MCP uses stdout for protocol, so all logs go to stderr.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.headlessLog = exports.watcherLog = exports.serverLog = exports.launcherLog = exports.ipcLog = void 0;
exports.setLogLevel = setLogLevel;
exports.getLogLevel = getLogLevel;
const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
let currentLevel = 'info';
function setLogLevel(level) {
    currentLevel = level;
}
function getLogLevel() {
    return currentLevel;
}
function shouldLog(level) {
    return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}
function formatMessage(prefix, level, message) {
    const timestamp = new Date().toISOString();
    return `${timestamp} [${prefix}] ${level.toUpperCase()}: ${message}`;
}
function createLogger(prefix) {
    return {
        debug(message) {
            if (shouldLog('debug')) {
                process.stderr.write(formatMessage(prefix, 'debug', message) + '\n');
            }
        },
        info(message) {
            if (shouldLog('info')) {
                process.stderr.write(formatMessage(prefix, 'info', message) + '\n');
            }
        },
        warn(message) {
            if (shouldLog('warn')) {
                process.stderr.write(formatMessage(prefix, 'warn', message) + '\n');
            }
        },
        error(message) {
            if (shouldLog('error')) {
                process.stderr.write(formatMessage(prefix, 'error', message) + '\n');
            }
        },
    };
}
exports.ipcLog = createLogger('IPC');
exports.launcherLog = createLogger('LAUNCHER');
exports.serverLog = createLogger('SERVER');
exports.watcherLog = createLogger('WATCHER');
exports.headlessLog = createLogger('HEADLESS');
//# sourceMappingURL=logger.js.map