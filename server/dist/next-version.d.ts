export declare const VERSION_GVL_FILE = "_MCP_PROJECT_VERSION.st";
/** Compare two dotted versions numerically (missing parts count as 0). */
export declare function cmpVersion(a: string, b: string): number;
/** X.Y.Z.W -> X.Y.Z.(W+1). */
export declare function nextBuild(version: string): string;
/** 'Name_001' -> 'Name_002' (width kept). undefined when there is no _NNN suffix. */
export declare function nextDriveFile(name: string | undefined): string | undefined;
/** Every _MCP_PROJECT_VERSION.st below the mirror (one per application). */
export declare function findVersionGvlFiles(mirrorDir: string): string[];
/** Parse sVersion / sDriveFile out of a version GVL declaration. */
export declare function parseVersionGvl(text: string): {
    version?: string;
    driveFile?: string;
};
/** The version the exported project carries (first application's GVL). */
export declare function readMirrorVersion(mirrorDir: string): {
    version?: string;
    driveFile?: string;
};
/**
 * True when the working copy already carries a version above the latest
 * release tag, i.e. it was prepared for the next build after that release.
 */
export declare function isPreparedAhead(workingVersion: string | undefined, latestTag: string): boolean;
/**
 * Facts for the download guard: is this working copy the next build that a
 * release prepared, with nothing changed since? Then a download would put a
 * number on the PLC that no release has: the released build is the tag.
 */
export interface PreparedState {
    /** The last commit of the .project is a "Prepare v..." commit and the file equals HEAD's. */
    unchangedSincePreparation: boolean;
    latestTag: string;
    preparedVersion?: string;
    preparedDriveFile?: string;
}
export declare function decideDownloadGuard(s: PreparedState): string | null;
/** Read the PreparedState of a project in a git repo; null outside git or without a tag. */
export declare function readPreparedState(projectFile: string, mirrorDir: string): PreparedState | null;
type Level = 'major' | 'minor' | 'revision' | 'build';
export type Classification = {
    kind: 'bump';
    level: Level;
    evidence: string[];
} | {
    kind: 'no-changes';
    evidence: string[];
} | {
    kind: 'first-run';
    evidence: string[];
};
/**
 * Drop the version files from a classification. In a prepared working copy the
 * GVL differs from the tag only because of the preparation, which is not a
 * code change. The level is recomputed from the remaining file lines.
 */
export declare function withoutVersionGvl(c: Classification): Classification;
export {};
//# sourceMappingURL=next-version.d.ts.map