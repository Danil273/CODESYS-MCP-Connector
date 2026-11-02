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
exports.parseInspectionXml = parseInspectionXml;
exports.inspectProjectFile = inspectProjectFile;
exports.suggestedServerName = suggestedServerName;
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
const PROFILE_VERSION_RE = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/;
/**
 * Pure XML-to-fields parser, factored out so unit tests can run without
 * spawning unzip or touching the filesystem.
 */
function parseInspectionXml(xml) {
    const profileName = extractTagText(xml, 'ProfileName');
    const profileVersion = extractTagText(xml, 'ProfileVersion');
    if (!profileName || !profileVersion) {
        throw new Error('Malformed projectinspectiondata.auxiliary: missing <ProfileName> or <ProfileVersion>');
    }
    const m = PROFILE_VERSION_RE.exec(profileVersion);
    if (!m) {
        throw new Error(`Malformed <ProfileVersion>: expected X.Y.Z.W, got "${profileVersion}"`);
    }
    const major = parseInt(m[1], 10);
    const minor = parseInt(m[2], 10);
    const sp = parseInt(m[3], 10);
    const rawPatch = parseInt(m[4], 10);
    const patch = Math.floor(rawPatch / 10);
    const mandatoryLibraries = extractMandatoryEntries(xml);
    return {
        profileName,
        profileVersion,
        major,
        minor,
        sp,
        patch,
        mandatoryLibraries,
    };
}
function extractTagText(xml, tag) {
    const re = new RegExp(`<${tag}>([^<]*)</${tag}>`);
    const m = re.exec(xml);
    return m ? m[1].trim() : undefined;
}
function extractMandatoryEntries(xml) {
    // Narrow to the <MandatoryTypes>...</MandatoryTypes> block so we don't pick
    // up entries from <OptionalPackages> below it.
    const blockMatch = /<MandatoryTypes>([\s\S]*?)<\/MandatoryTypes>/.exec(xml);
    if (!blockMatch)
        return [];
    const block = blockMatch[1];
    const out = [];
    const detailRe = /<ProjectInspectionDetail>([\s\S]*?)<\/ProjectInspectionDetail>/g;
    let dm;
    while ((dm = detailRe.exec(block)) !== null) {
        const inner = dm[1];
        const typeGuid = extractTagText(inner, 'TypeGuid');
        // Prefer the package-level name/version when present (those are the
        // user-meaningful "library" labels); fall back to the plugin-level
        // metadata which is what the per-object detail rows carry.
        const title = extractTagText(inner, 'OwningPackageName') ??
            extractTagText(inner, 'OwningPluginName');
        const version = extractTagText(inner, 'OwningPackageVersion') ??
            extractTagText(inner, 'OwningPluginVersion');
        out.push({ typeGuid, title, version });
    }
    return out;
}
/**
 * Reads + parses a CODESYS .project file and returns its inspection metadata.
 *
 * Uses the `unzip` CLI (ships with Git for Windows; standard on Linux/Mac)
 * to keep the dependency surface zero -- the wider package has no ZIP-related
 * deps and we want to keep it that way.
 */
async function inspectProjectFile(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Project file not found: ${filePath}`);
    }
    let xml;
    try {
        const buf = (0, child_process_1.execFileSync)('unzip', ['-p', filePath, 'projectinspectiondata.auxiliary'], {
            stdio: ['ignore', 'pipe', 'pipe'],
            maxBuffer: 16 * 1024 * 1024,
        });
        xml = buf.toString('utf8');
    }
    catch (err) {
        const e = err;
        if (e.code === 'ENOENT') {
            throw new Error('unzip CLI required (ships with Git for Windows / standard on Linux+Mac)');
        }
        const stderr = e.stderr ? e.stderr.toString('utf8') : '';
        throw new Error(`Failed to read project ZIP "${filePath}": ${stderr || err.message}`);
    }
    if (!xml || xml.trim().length === 0) {
        throw new Error(`${filePath} is not a CODESYS .project (no projectinspectiondata.auxiliary entry)`);
    }
    const parsed = parseInspectionXml(xml);
    return {
        filePath,
        ...parsed,
    };
}
/**
 * Derives the same `codesys-spXX[-patchN]` server-entry name that --detect
 * uses, so users can quickly map a project to the matching .mcp.json entry.
 */
function suggestedServerName(sp, patch) {
    const head = `codesys-sp${sp}`;
    return patch === 0 ? head : `${head}-patch${patch}`;
}
//# sourceMappingURL=inspect.js.map