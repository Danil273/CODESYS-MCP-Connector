"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveValuesPump = void 0;
exports.parseVarDecls = parseVarDecls;
exports.parseVarNames = parseVarNames;
const live_values_write_1 = require("./live-values-write");
const state_read_1 = require("./state-read");
const VAR_OPEN_RE = /^\s*(?:VAR(?:_INPUT|_OUTPUT|_IN_OUT|_GLOBAL|_TEMP|_CONFIG|_EXTERNAL|_STAT)?)\b/i;
const VAR_CLOSE_RE = /^\s*END_VAR\b/i;
const VAR_DECL_RE = /^\s*([A-Za-z_]\w*)\b/;
// `name [AT %loc] : <type>` -- captures the type name (first identifier after ':').
// Type may be a primitive (INT/BOOL), an ARRAY, a POINTER, a REFERENCE, or a
// user-defined identifier. We only return the leaf identifier; ARRAY / POINTER
// / REFERENCE-OF wrappers don't contribute a sub-property scan.
const VAR_TYPE_RE = /:\s*(?:ARRAY\s*\[[^\]]+\]\s*OF\s+|POINTER\s+TO\s+|REFERENCE\s+TO\s+)?([A-Za-z_]\w*)/i;
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
function parseVarDecls(text) {
    const decls = [];
    const lines = text.split(/\r?\n/);
    let inVarBlock = false;
    let inMultilineComment = false;
    for (const raw of lines) {
        let scrubbed = '';
        let i = 0;
        while (i < raw.length) {
            if (inMultilineComment) {
                const end = raw.indexOf('*)', i);
                if (end < 0) {
                    i = raw.length;
                }
                else {
                    inMultilineComment = false;
                    i = end + 2;
                }
                continue;
            }
            if (raw[i] === '(' && raw[i + 1] === '*') {
                const end = raw.indexOf('*)', i + 2);
                if (end < 0) {
                    inMultilineComment = true;
                    i = raw.length;
                }
                else {
                    i = end + 2;
                }
                continue;
            }
            scrubbed += raw[i];
            i++;
        }
        const slash = scrubbed.indexOf('//');
        if (slash >= 0)
            scrubbed = scrubbed.slice(0, slash);
        if (!inVarBlock) {
            if (VAR_OPEN_RE.test(scrubbed))
                inVarBlock = true;
            continue;
        }
        if (VAR_CLOSE_RE.test(scrubbed)) {
            inVarBlock = false;
            continue;
        }
        const nameM = VAR_DECL_RE.exec(scrubbed);
        if (!nameM)
            continue;
        const typeM = VAR_TYPE_RE.exec(scrubbed);
        decls.push({ name: nameM[1], type: typeM ? typeM[1] : null });
    }
    return decls;
}
/** Backward-compat: name-only view used by callers that don't need types yet. */
function parseVarNames(text) {
    return parseVarDecls(text).map((d) => d.name);
}
class LiveValuesPump {
    constructor(cfg, deps) {
        this.cfg = cfg;
        this.timer = null;
        this.busy = false;
        this.deps = {
            readSelection: deps.readSelection ?? state_read_1.readSelection,
            readPouFile: deps.readPouFile ?? (() => Promise.reject(new Error('readPouFile not provided'))),
            // No resolver provided -> never descend (no sub-property paths). Pump
            // still works for top-level vars only, matching v0.3 behaviour.
            resolveTypeMirror: deps.resolveTypeMirror ?? (async () => null),
            readVariable: deps.readVariable ?? (() => Promise.reject(new Error('readVariable not provided'))),
            writeLiveValues: deps.writeLiveValues ?? live_values_write_1.writeLiveValues,
        };
    }
    start() {
        if (this.timer)
            return;
        this.timer = setInterval(() => {
            void this.tick();
        }, this.cfg.intervalMs);
    }
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    async tick() {
        if (this.busy)
            return;
        this.busy = true;
        try {
            const sel = await this.deps.readSelection(this.cfg.stateFilePath);
            if (sel.status !== 'ok')
                return;
            const pou = sel.payload.selection;
            const text = await this.deps.readPouFile(pou.abs_path);
            const decls = parseVarDecls(text);
            if (decls.length === 0)
                return;
            // Build the read-list: top-level vars + depth-1 sub-properties when
            // the type resolves to another mirror .st file.
            // Each entry maps the dotted PLC path (PLC_PRG.fb.x) to the snapshot
            // key the TUI overlay matches against (the leaf name -- TUI matches
            // identifiers in the line text, so `x` is what the line says).
            const reads = [];
            const deviceRoot = this.deviceRootFor(pou.abs_path);
            for (const d of decls) {
                reads.push({ pouPath: `${pou.name}.${d.name}`, key: d.name });
                if (!d.type)
                    continue;
                const childText = await this.deps.resolveTypeMirror(d.type, deviceRoot);
                if (!childText)
                    continue;
                for (const cd of parseVarDecls(childText)) {
                    reads.push({
                        pouPath: `${pou.name}.${d.name}.${cd.name}`,
                        // Overlay key is the LEAF name -- the TUI scans line text for
                        // identifiers and matches against this map. Sub-property names
                        // win over top-level when they collide; that's harmless because
                        // a struct's member would only appear inside the struct's own
                        // declaration, not the parent POU's source.
                        key: cd.name,
                    });
                }
            }
            const values = {};
            const ts = Date.now();
            for (const r of reads) {
                try {
                    const v = await this.deps.readVariable(sel.payload.project_dir, r.pouPath);
                    values[r.key] = { value: v, ts };
                }
                catch {
                    // single-var failure: skip silently, others may succeed
                }
            }
            await this.deps.writeLiveValues(this.cfg.liveValuesFilePath, sel.payload.project_dir, {
                device: sel.payload.device,
                pou_name: pou.name,
                values,
            });
        }
        catch {
            // Pump must never crash; swallow.
        }
        finally {
            this.busy = false;
        }
    }
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
    deviceRootFor(absPath) {
        const norm = absPath.replace(/\\/g, '/');
        const idx = norm.lastIndexOf('/mcp-mirror/');
        if (idx < 0) {
            const p = norm.split('/');
            p.pop();
            return p.join('/');
        }
        const after = norm.slice(idx + '/mcp-mirror/'.length);
        const deviceName = after.split('/')[0];
        return `${norm.slice(0, idx)}/mcp-mirror/${deviceName}`;
    }
}
exports.LiveValuesPump = LiveValuesPump;
//# sourceMappingURL=live-values-pump.js.map