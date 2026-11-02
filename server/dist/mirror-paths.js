"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveMirrorRoot = resolveMirrorRoot;
/**
 * Resolution rules for the source-mirror directory written by mirror_export.
 *
 * Why this is non-trivial: the historical default was always
 * `<projectDir>/mcp-mirror/`. That breaks when two `.project` files share
 * a parent directory (e.g. `Multi plc test/ProjectA.project` +
 * `Multi plc test/ProjectB.project` both default to the same mirror, and
 * each `mirror_export` call clobbers the other's output -- and worse,
 * `release_project_version`'s git-tag-based history mis-attributes commits
 * across projects).
 *
 * The fix has to be backwards-compatible: existing projects already have
 * `mcp-mirror/` directories whose path is baked into v* tags + commit
 * history. Renaming the dir would break that history. So the resolution
 * logic preserves the legacy path whenever it can:
 *
 *   1. If `<projectDir>/mcp-mirror/` already exists, use it (legacy mode,
 *      single-project parent dir on existing setups).
 *   2. Else if `<projectDir>` contains exactly one `.project` file, use
 *      `<projectDir>/mcp-mirror/` (legacy default for new single-project
 *      setups too -- preserves the well-known docs path).
 *   3. Else (multiple `.project` siblings, no existing mcp-mirror) use
 *      `<projectDir>/<basename>_mcp_mirror/` so each project gets its own
 *      mirror tree without collision.
 *
 * The logic is mirrored verbatim in src/scripts/mirror_export.py so the
 * CODESYS-side script computes the same default. Keep them in sync.
 */
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const realFs = {
    existsSync: (p) => fs.existsSync(p),
    statSync: (p) => fs.statSync(p),
    readdirSync: (p) => fs.readdirSync(p),
};
/**
 * Resolve the mirror root for a given .project file. Returns an absolute
 * path. The fs argument is for tests; production callers omit it.
 *
 * Defensive on every fs call -- a permissions hiccup or a stat race must
 * not crash the auto-mirror flow. Worst case we fall back to the legacy
 * `<projectDir>/mcp-mirror/` path.
 */
function resolveMirrorRoot(projectFilePath, fsImpl = realFs) {
    const projectDir = path.dirname(projectFilePath);
    const legacy = path.join(projectDir, 'mcp-mirror');
    // Rule 1: existing mcp-mirror/ wins, regardless of how many .project
    // files sit beside it. Preserves git history on every project ever
    // mirrored before this fix landed.
    try {
        if (fsImpl.existsSync(legacy)) {
            const st = fsImpl.statSync(legacy);
            if (st.isDirectory())
                return legacy;
        }
    }
    catch {
        // existsSync should never throw, but statSync can race with deletion;
        // fall through to the .project-count branch.
    }
    // Rules 2 + 3: count .project siblings. One = legacy path, multiple =
    // per-project naming.
    let projectSiblings = 0;
    try {
        const entries = fsImpl.readdirSync(projectDir);
        for (const e of entries) {
            // Case-insensitive match -- Windows treats Foo.PROJECT and foo.project
            // as the same extension.
            if (e.toLowerCase().endsWith('.project'))
                projectSiblings++;
        }
    }
    catch {
        // Project dir unreadable (network share blip, perms). Default to legacy
        // so we don't surprise anyone with a new path on transient failure.
        return legacy;
    }
    if (projectSiblings <= 1)
        return legacy;
    const base = path.basename(projectFilePath, '.project');
    return path.join(projectDir, `${base}_mcp_mirror`);
}
//# sourceMappingURL=mirror-paths.js.map