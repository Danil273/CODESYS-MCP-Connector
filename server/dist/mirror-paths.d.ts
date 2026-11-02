/**
 * Filesystem facade so tests can inject a fake without touching real disk.
 */
export interface MirrorPathFs {
    existsSync: (p: string) => boolean;
    statSync: (p: string) => {
        isDirectory: () => boolean;
    };
    readdirSync: (p: string) => string[];
}
/**
 * Resolve the mirror root for a given .project file. Returns an absolute
 * path. The fs argument is for tests; production callers omit it.
 *
 * Defensive on every fs call -- a permissions hiccup or a stat race must
 * not crash the auto-mirror flow. Worst case we fall back to the legacy
 * `<projectDir>/mcp-mirror/` path.
 */
export declare function resolveMirrorRoot(projectFilePath: string, fsImpl?: MirrorPathFs): string;
//# sourceMappingURL=mirror-paths.d.ts.map