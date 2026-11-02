/**
 * Guards against UNC network paths for project files.
 *
 * CODESYS cannot reliably open/save projects served straight from a Windows UNC
 * path (\\server\share\...). The script engine and the IDE's project-open path
 * tend to fail late and opaquely on these. A mapped drive letter (e.g. Z: ->
 * \\server\share) works fine, so the fix for the user is always the same: map
 * the share or copy the project locally. We detect UNC up front and return a
 * clear, actionable error instead of letting CODESYS fail mid-way.
 */
/**
 * True when `p` is a Windows UNC path (\\server\share\... or the extended-length
 * \\?\UNC\server\share form). Mapped drive letters (Z:\...) and ordinary local
 * drives (C:\...) are NOT UNC, including the extended-length \\?\C:\ form.
 */
export declare function isUncPath(p: string): boolean;
/**
 * Returns a clear, actionable error message if `resolvedPath` is a UNC path,
 * otherwise null. `label` names the path in the message (e.g. "project file").
 */
export declare function uncPathError(resolvedPath: string, label?: string): string | null;
//# sourceMappingURL=path-guard.d.ts.map