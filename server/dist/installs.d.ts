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
import { CodesysInstall } from './detect';
/** What the server needs to know about one CODESYS install. */
export interface InstallSpec {
    exePath: string;
    profileName: string;
    additionalFolder?: string;
    sp: number;
    patch: number;
    /** Short label used in tool responses and the `install` argument, e.g. "SP21 Patch 5". */
    label: string;
}
export declare function labelFor(sp: number, patch: number): string;
export declare function specFromInstall(i: CodesysInstall): InstallSpec;
/**
 * Spec for an install given explicitly (--codesys-path / --codesys-profile).
 * SP and patch come from the profile name; an unparseable profile gets sp=0.
 */
export declare function specFromExplicit(exePath: string, profileName: string, additionalFolder?: string): InstallSpec;
/**
 * Match a user-supplied install query against the known installs.
 * Accepts "21", "SP21", "sp21 patch 5", "SP21P5", "3.5.21.50", the full
 * profile name, or a path to CODESYS.exe. With several patches of one SP,
 * a bare "SP21" picks the highest patch.
 */
export declare function matchInstall(installs: InstallSpec[], query: string): InstallSpec | undefined;
export type ProjectPick = {
    kind: 'exact';
    install: InstallSpec;
} | {
    kind: 'same-sp';
    install: InstallSpec;
} | {
    kind: 'none';
};
/**
 * Pick the install for a project saved with SP<sp> Patch <patch>: the exact
 * install if present, else the highest patch of the same SP (CODESYS asks
 * about the patch difference on open), else none. Never another SP: opening
 * an SP21 project in SP22 converts it.
 */
export declare function pickInstallForProject(installs: InstallSpec[], sp: number, patch: number): ProjectPick;
/** Newest install (highest SP, then patch); the default when nothing else decides. */
export declare function newestInstall(installs: InstallSpec[]): InstallSpec;
/** Project file -> its saved SP/patch, cached by path and mtime. */
export declare class ProjectProfileCache {
    private cache;
    /** Store a version found another way (CODESYS read it from a throwaway copy). */
    remember(projectPath: string, sp: number, patch: number): void;
    get(projectPath: string): Promise<{
        sp: number;
        patch: number;
    } | null>;
}
//# sourceMappingURL=installs.d.ts.map