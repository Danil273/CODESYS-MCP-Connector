/**
 * Subprocess client for the CODESYS-shipped MCP bridge (CodesysMCPBridge.exe
 * shim that ships in CODESYS 3.5.22.10+ next to CODESYS.exe). The shim is
 * the only piece that speaks MCP; it forwards each call to the in-IDE
 * plugin via a private named pipe whose wire format is not MCP-compatible,
 * so we go through the shim's stdio rather than the pipe directly.
 *
 * Why: the bridge plugin runs in-process inside CODESYS, so its authoring
 * tools (create_or_replace_structured_text_object, browse_project_tree, ...)
 * mutate the live project graph and the editor view picks the change up
 * immediately. Our existing IronPython watcher modifies the project graph
 * from a primary-thread script but never touches the editor layer, so POUs
 * don't pop open as they change. Wrapping the bridge gives us that live view
 * for free on SP22+, while keeping the watcher as the SP19/SP21 fallback and
 * the home of every online/runtime/release tool the bridge doesn't ship.
 */
import { z } from 'zod';
/**
 * Find CodesysMCPBridge.exe processes that have been orphaned — i.e. whose
 * parent process is no longer alive. Such a bridge can never be re-attached
 * to (the stdio pipe that drove it died with its parent), so it is pure
 * garbage and safe to kill.
 *
 * Why dead-parent rather than "all bridges": a single sweep must not touch a
 * bridge that belongs to a *live* MCP session — both the `codesys-ide` direct
 * server (spawned by the MCP client) and a concurrently-running orchestrator
 * keep a living parent, so they are correctly preserved. Only the leftovers
 * from sessions that already exited are reaped.
 *
 * Returns an empty list on non-Windows or if the probe fails — we treat that
 * as "can't tell" rather than risk killing something we shouldn't.
 */
export declare function findOrphanedBridgePids(): number[];
/**
 * Kill any orphaned bridge shims (see {@link findOrphanedBridgePids}). Returns
 * the PIDs actually reaped. Called at server startup so each fresh orchestrator
 * cleans up the garbage left by sessions that exited without reaping their
 * bridge (e.g. a hard SIGKILL of a prior orchestrator, or a stale `codesys-ide`
 * direct-server bridge whose MCP client has since closed).
 */
export declare function killOrphanedBridges(): number[];
/** Tool descriptor returned by the bridge's tools/list. */
export interface BridgeTool {
    name: string;
    description?: string;
    inputSchema?: JsonSchema;
}
/** Minimal subset of JSON Schema we recognise. Anything else falls back to z.unknown(). */
export interface JsonSchema {
    type?: string | string[];
    properties?: Record<string, JsonSchema>;
    required?: string[];
    items?: JsonSchema | JsonSchema[];
    enum?: unknown[];
    description?: string;
    default?: unknown;
}
/**
 * JSON-RPC 2.0 client over a child-process stdio pair. The bridge shim
 * (`CodesysMCPBridge.exe`) speaks newline-delimited MCP/JSON-RPC and
 * forwards each call to the in-IDE plugin via its own named pipe.
 */
export declare class IdeBridgeClient {
    private readonly exePath;
    private proc;
    private nextId;
    private pending;
    private buffer;
    private connected;
    constructor(exePath: string);
    /** PID of the spawned bridge shim, or null if not currently connected. */
    get pid(): number | null;
    /**
     * Default location of the bridge shim alongside CODESYS.exe. Returns null
     * if the bridge isn't installed (SP19/SP21, or SP22+ before the user has
     * upgraded the install to one that ships the bridge).
     */
    static defaultExePath(codesysExePath: string): string | null;
    /**
     * Spawn the bridge shim and wire up its stdio. Resolves once the process
     * has started; the MCP `initialize` handshake is a separate call.
     */
    connect(timeoutMs?: number): Promise<void>;
    /**
     * MCP `initialize` handshake. Must be called once before any other request.
     */
    initialize(): Promise<void>;
    /** Fetch the bridge's tool list. */
    listTools(): Promise<BridgeTool[]>;
    /** Call a bridge tool by name with raw arguments. Returns the bridge's result envelope unchanged. */
    callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
    /** Kill the bridge shim. Safe to call repeatedly. */
    close(): void;
    private request;
    private notify;
    private onData;
    private dispatch;
    private onProcExit;
}
/**
 * Minimal JSON-Schema-to-Zod-shape converter. The MCP SDK's `tool()` API takes
 * a Record<string, ZodType> describing the args; the bridge gives us a full
 * JSON-Schema object whose `properties` map onto exactly that shape. Anything
 * we don't recognise falls back to z.unknown() so the call still goes through.
 */
export declare function bridgeSchemaToZodShape(schema: JsonSchema | undefined): Record<string, z.ZodTypeAny>;
//# sourceMappingURL=ide-bridge.d.ts.map