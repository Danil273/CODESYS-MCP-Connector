import { writeLiveValues } from './live-values-write';
import { readSelection } from './state-read';
export interface VarDecl {
    name: string;
    /** Declared type as written. null if we couldn't extract a type identifier. */
    type: string | null;
}
/**
 * Parse all variable declarations in any VAR / VAR_INPUT / VAR_OUTPUT /
 * VAR_GLOBAL / etc. block. Returns name + declared type per decl. Skips
 * (* ... *) comments (joined across lines) and `// ...` line comments.
 *
 * Recognises `name [AT %loc] : [ARRAY [...] OF | POINTER TO | REFERENCE TO]
 * <type> [:= init];`. Wrapper modifiers (ARRAY/POINTER/REFERENCE) are
 * stripped — the inner type is what we'd descend into for sub-property
 * paths, and a containing ARRAY of struct doesn't get pretty-printed in
 * v0.3+ anyway. Multi-name shorthand 'a, b : INT;' yields only the first
 * name (vanishingly rare in practice).
 */
export declare function parseVarDecls(text: string): VarDecl[];
/** Backward-compat: name-only view used by callers that don't need types yet. */
export declare function parseVarNames(text: string): string[];
export interface PumpDeps {
    /** Read the TUI selection state file. Defaults to readSelection. */
    readSelection?: typeof readSelection;
    /** Read the POU's mirror file from disk. */
    readPouFile?: (absPath: string) => Promise<string>;
    /**
     * Resolve a user-defined type name to its mirror .st file content,
     * or return null if no such mirror file exists (built-in types,
     * library types we can't introspect, etc.). Used for sub-property
     * descent.
     */
    resolveTypeMirror?: (typeName: string, deviceRoot: string) => Promise<string | null>;
    /** Read a single PLC variable. Returns its current value as a string. */
    readVariable?: (projectFilePath: string, variablePath: string) => Promise<string>;
    /** Write the live-values snapshot. Defaults to writeLiveValues. */
    writeLiveValues?: typeof writeLiveValues;
}
export interface PumpConfig {
    /** Path to tui-state.json. */
    stateFilePath: string;
    /** Path to tui-live-values.json. */
    liveValuesFilePath: string;
    /** Poll interval in ms. */
    intervalMs: number;
}
export declare class LiveValuesPump {
    private cfg;
    private timer;
    private busy;
    private deps;
    constructor(cfg: PumpConfig, deps: PumpDeps);
    start(): void;
    stop(): void;
    tick(): Promise<void>;
    /**
     * Given a POU's abs path under a mirror tree, return the device root
     * (the directory where its sibling .st files live). Used by
     * resolveTypeMirror to look up `<TypeName>.st` next to the current POU.
     *
     * Example:
     *   /abs/proj/mcp-mirror/CodesysRpi/Plc Logic/Application/PLC_PRG.st
     *   -> /abs/proj/mcp-mirror/CodesysRpi
     *
     * The mirror layout always has a `mcp-mirror/<deviceName>/...` shape, so
     * we walk up until we find that segment. If we can't, return the parent
     * dir as a best-effort (resolveTypeMirror still works for same-folder
     * lookups, just won't find types declared in sibling folders).
     */
    private deviceRootFor;
}
//# sourceMappingURL=live-values-pump.d.ts.map