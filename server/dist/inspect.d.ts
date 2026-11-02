/**
 * Offline inspection of a CODESYS .project file.
 *
 * WHY: Knowing which CODESYS install opens a project (and which mandatory
 * libraries / packages it expects) without spawning CODESYS itself lets users
 * pick the right --codesys-path / --codesys-profile up front, surface
 * mismatches in CI, and audit projects on Linux/Mac where CODESYS doesn't run.
 *
 * The inspection data lives in `projectinspectiondata.auxiliary` -- a plain
 * XML entry inside the .project ZIP archive. The schema is stable enough that
 * regex extraction is sufficient (and avoids adding an XML-parser dependency).
 */
export interface MandatoryLibraryEntry {
    typeGuid?: string;
    title?: string;
    version?: string;
}
export interface InspectionResult {
    filePath: string;
    profileName: string;
    profileVersion: string;
    major: number;
    minor: number;
    sp: number;
    patch: number;
    mandatoryLibraries: MandatoryLibraryEntry[];
}
/**
 * Pure XML-to-fields parser, factored out so unit tests can run without
 * spawning unzip or touching the filesystem.
 */
export declare function parseInspectionXml(xml: string): {
    profileName: string;
    profileVersion: string;
    major: number;
    minor: number;
    sp: number;
    patch: number;
    mandatoryLibraries: MandatoryLibraryEntry[];
};
/**
 * Reads + parses a CODESYS .project file and returns its inspection metadata.
 *
 * Uses the `unzip` CLI (ships with Git for Windows; standard on Linux/Mac)
 * to keep the dependency surface zero -- the wider package has no ZIP-related
 * deps and we want to keep it that way.
 */
export declare function inspectProjectFile(filePath: string): Promise<InspectionResult>;
/**
 * Derives the same `codesys-spXX[-patchN]` server-entry name that --detect
 * uses, so users can quickly map a project to the matching .mcp.json entry.
 */
export declare function suggestedServerName(sp: number, patch: number): string;
//# sourceMappingURL=inspect.d.ts.map