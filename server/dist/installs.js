"use strict";
/**
 * One MCP server for every installed CODESYS version.
 *
 * Before 0.19.0 each MCP entry was bound to one install (--codesys-path at
 * startup), so a machine with SP19, SP21 and SP22 needed three entries: three
 * times the ~126 tools in every session, three reconnects, and picking the
 * right entry by hand (an SP21 project opened through the SP22 entry pops the
 * conversion dialog). Now the server knows every install and each tool call
 * picks one: an explicit `install` argument, else the install matching the
 * project file's saved profile, else the install used last.
 */
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
exports.ProjectProfileCache = void 0;
exports.labelFor = labelFor;
exports.specFromInstall = specFromInstall;
exports.specFromExplicit = specFromExplicit;
exports.matchInstall = matchInstall;
exports.pickInstallForProject = pickInstallForProject;
exports.newestInstall = newestInstall;
const fs = __importStar(require("fs"));
const detect_1 = require("./detect");
const inspect_1 = require("./inspect");
const version_pin_1 = require("./version-pin");
function labelFor(sp, patch) {
    return patch === 0 ? `SP${sp}` : `SP${sp} Patch ${patch}`;
}
function specFromInstall(i) {
    return {
        exePath: i.exePath,
        profileName: i.profileName,
        additionalFolder: i.additionalFolder,
        sp: i.sp,
        patch: i.patch,
        label: labelFor(i.sp, i.patch),
    };
}
/**
 * Spec for an install given explicitly (--codesys-path / --codesys-profile).
 * SP and patch come from the profile name; an unparseable profile gets sp=0.
 */
function specFromExplicit(exePath, profileName, additionalFolder) {
    const p = (0, detect_1.parseProfileName)(profileName) ?? { sp: 0, patch: 0 };
    return { exePath, profileName, additionalFolder, sp: p.sp, patch: p.patch, label: labelFor(p.sp, p.patch) };
}
/**
 * Match a user-supplied install query against the known installs.
 * Accepts "21", "SP21", "sp21 patch 5", "SP21P5", "3.5.21.50", the full
 * profile name, or a path to CODESYS.exe. With several patches of one SP,
 * a bare "SP21" picks the highest patch.
 */
function matchInstall(installs, query) {
    const q = query.trim().toLowerCase();
    if (!q)
        return undefined;
    const norm = (s) => s.toLowerCase().replace(/\\/g, '/');
    const byPath = installs.find((i) => norm(i.exePath) === norm(q));
    if (byPath)
        return byPath;
    const byProfile = installs.find((i) => i.profileName.toLowerCase() === q);
    if (byProfile)
        return byProfile;
    let sp;
    let patch;
    const ver = /^3\.5\.(\d+)\.(\d)\d*$/.exec(q);
    const spm = /^(?:sp\s*)?(\d+)(?:\s*(?:patch|p)\s*(\d+))?$/.exec(q.replace(/^codesys\s*(v3\.5\s*)?/, ''));
    if (ver) {
        sp = parseInt(ver[1], 10);
        patch = parseInt(ver[2], 10);
    }
    else if (spm) {
        sp = parseInt(spm[1], 10);
        patch = spm[2] !== undefined ? parseInt(spm[2], 10) : undefined;
    }
    if (sp === undefined)
        return undefined;
    const sameSp = installs.filter((i) => i.sp === sp);
    if (patch !== undefined)
        return sameSp.find((i) => i.patch === patch);
    return sameSp.sort((a, b) => b.patch - a.patch)[0];
}
/**
 * Pick the install for a project saved with SP<sp> Patch <patch>: the exact
 * install if present, else the highest patch of the same SP (CODESYS asks
 * about the patch difference on open), else none. Never another SP: opening
 * an SP21 project in SP22 converts it.
 */
function pickInstallForProject(installs, sp, patch) {
    const exact = installs.find((i) => i.sp === sp && i.patch === patch);
    if (exact)
        return { kind: 'exact', install: exact };
    const same = installs.filter((i) => i.sp === sp).sort((a, b) => b.patch - a.patch)[0];
    if (same)
        return { kind: 'same-sp', install: same };
    return { kind: 'none' };
}
/** Newest install (highest SP, then patch); the default when nothing else decides. */
function newestInstall(installs) {
    return [...installs].sort((a, b) => b.sp - a.sp || b.patch - a.patch)[0];
}
/** Project file -> its saved SP/patch, cached by path and mtime. */
class ProjectProfileCache {
    constructor() {
        this.cache = new Map();
    }
    /** Store a version found another way (CODESYS read it from a throwaway copy). */
    remember(projectPath, sp, patch) {
        try {
            this.cache.set(projectPath, { mtimeMs: fs.statSync(projectPath).mtimeMs, sp, patch });
        }
        catch {
            // file gone: nothing to remember
        }
    }
    async get(projectPath) {
        let mtimeMs;
        try {
            mtimeMs = fs.statSync(projectPath).mtimeMs;
        }
        catch {
            return null; // not there yet (create_project) or unreadable
        }
        const hit = this.cache.get(projectPath);
        if (hit && hit.mtimeMs === mtimeMs)
            return { sp: hit.sp, patch: hit.patch };
        try {
            const r = await (0, inspect_1.inspectProjectFile)(projectPath);
            this.cache.set(projectPath, { mtimeMs, sp: r.sp, patch: r.patch });
            return { sp: r.sp, patch: r.patch };
        }
        catch {
            // Not a ZIP: CODESYS also saves projects in a binary format with no
            // readable version (many real projects, and everything projects.create
            // writes). Then the repo's .codesys-version pin or library.md tells.
            const pin = (0, version_pin_1.resolveVersionPin)(projectPath);
            // Not cached: the pin can change without the .project changing.
            if (pin)
                return { sp: pin.sp, patch: pin.patch };
            return null;
        }
    }
}
exports.ProjectProfileCache = ProjectProfileCache;
//# sourceMappingURL=installs.js.map