/**
 * Repo-side CODESYS version pin.
 *
 * WHY: `src/inspect.ts` reads a project's authored CODESYS version out of
 * `projectinspectiondata.auxiliary` inside the .project ZIP. That works for
 * `.projectarchive` files -- but a plain `.project` is NOT a ZIP. Verified
 * 2026-07-24 against three projects spanning 3.5.19.20 .. 3.5.22.10: all
 * begin with magic `23 89 ED 33`, `unzip -l` fails on all of them, and no
 * plaintext profile string survives the container's compression.
 *
 * Consequence: `inspectProjectFile` throws for real projects, the
 * `open_project` pre-flight swallows the throw and proceeds, and a server
 * bound to a NEWER CODESYS silently converts the project on the next save.
 * That is how a vessel project's v1.0.0.0 got cut on SP21 Patch 5 from a 3.5.19.20
 * project: 4,639,776 B -> 4,688,496 B, and the tagged binary stopped being
 * the software that is on the ship.
 *
 * Since the version cannot be recovered from the file, it has to come from
 * the repo. Two sources, most-specific first:
 *
 *   1. `.codesys-version` next to the .project -- one line, either a profile
 *      version (`3.5.19.20`) or a profile name (`CODESYS V3.5 SP19`). This is
 *      the human-supplied pin, and the only option when seeding a project
 *      that has no release history yet.
 *   2. The `CODESYS Development System` row of a previously generated
 *      `library.md` -- records which IDE last touched the project, so every
 *      project gets a pin for free after its first release.
 *
 * Policy is deliberately asymmetric (see `decideVersionPin`): a mismatch
 * REFUSES tools that save, and only WARNS on tools that merely read. An
 * unknown version warns rather than refusing, so existing repos keep working
 * until they are pinned.
 */
export interface VersionPin {
    sp: number;
    patch: number;
    /** Where the pin came from, for the operator-facing message. */
    source: '.codesys-version' | 'library.md';
    /** Verbatim text the pin was parsed from. */
    raw: string;
}
export interface PinnedProfile {
    sp: number;
    patch: number;
}
export type PinDecision = {
    action: 'proceed';
} | {
    action: 'proceed-with-warning';
    message: string;
} | {
    action: 'refuse';
    message: string;
};
/** `3.5.19.20` -> { sp: 19, patch: 2 }. rawPatch/10 matches install-dir convention. */
export declare function parseProfileVersion(text: string): PinnedProfile | undefined;
/** `CODESYS V3.5 SP21 Patch 5` -> { sp: 21, patch: 5 }. Patch defaults to 0. */
export declare function parseProfileLabel(text: string): PinnedProfile | undefined;
/**
 * Either form, version first -- `3.5.21.50` and `SP21 Patch 5` describe the
 * same install, but a line carrying both should be read as the version.
 */
export declare function parsePinText(text: string): PinnedProfile | undefined;
/**
 * Pulls the profile out of library.md's version table. The row looks like:
 *
 *   | CODESYS Development System | `CODESYS.exe CODESYS V3.5 SP21 Patch 5, ScriptEngine.plugin 4.2.0.0` |
 *
 * Only the SP/Patch label is meaningful here -- the row carries no dotted
 * profile version -- so this deliberately does not fall back to
 * `parseProfileVersion`, which would otherwise match `3.5` or the
 * ScriptEngine's `4.2.0.0`.
 */
export declare function parseLibraryMdProfile(markdown: string): PinnedProfile | undefined;
/** Reads whichever pin is available for the project, most-specific first. */
export declare function resolveVersionPin(projectFilePath: string): VersionPin | undefined;
export declare function label(p: PinnedProfile): string;
/**
 * Compares the project's pinned version against the server's configured one.
 *
 * `saves` marks tools that write the .project back (bump/release). Those are
 * the ones that actually perform the conversion, so they refuse on any
 * mismatch and on an unknown-but-required pin. Read-only tools warn, because
 * a warning is enough to stop a human before they run the release, and
 * refusing every read would break existing unpinned repos.
 */
export declare function decideVersionPin(pin: VersionPin | undefined, server: PinnedProfile | undefined, opts: {
    saves: boolean;
    allowUpgrade?: boolean;
    projectFilePath: string;
}): PinDecision;
//# sourceMappingURL=version-pin.d.ts.map