import * as fs from 'fs';
export interface CodesysInstall {
    installDir: string;
    exePath: string;
    version: string;
    major: number;
    minor: number;
    sp: number;
    patch: number;
    profileName: string;
    serverName: string;
    /**
     * The AdditionalFolders installation carrying the most registered plugins,
     * if any. See LauncherConfig.additionalFolder -- without passing this the
     * IDE boots the bare base profile and scripting is unavailable.
     */
    additionalFolder?: string;
}
export declare function parseProfileName(name: string): {
    sp: number;
    patch: number;
} | null;
export declare function detectInstalls(searchDirs?: string[], fsApi?: {
    readdirSync: typeof fs.readdirSync;
    existsSync: typeof fs.existsSync;
    readFileSync?: typeof fs.readFileSync;
}): CodesysInstall[];
export interface PrintConfigOptions {
    sp?: number;
    name?: string;
    date?: string;
    /**
     * When set, the caller has already pre-filtered `installs` based on a
     * .project file's saved profile (see --for-project in bin.ts). printConfig
     * just renders -- the matching logic stays in bin.ts so detect.ts can stay
     * independent of inspect.ts. The hint drives the header comment block.
     */
    forProjectHint?: {
        profileName: string;
        profileVersion: string;
        matchKind: 'exact' | 'sp-only-fallback';
    };
}
export declare function printConfig(installs: CodesysInstall[], opts?: PrintConfigOptions): string;
/**
 * One MCP entry for every detected install (0.19.0+): no --codesys-path, so
 * the server drives all of them and each tool call picks the install from
 * the project file. The per-install entries of printConfig still work.
 */
export declare function printMultiConfig(installs: CodesysInstall[], opts?: {
    date?: string;
}): string;
//# sourceMappingURL=detect.d.ts.map