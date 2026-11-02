/**
 * Automatic attach: run the attach script in a CODESYS the user opened, with
 * no one at the keyboard.
 *
 * scripts/attach_uia.ps1 presses Tools > Scripting > Execute Script File...
 * of the CODESYS with the given PID through the accessibility interface of
 * its WinForms menu (MSAA, the provider UI Automation wraps), puts the
 * script path into the Open dialog's file name box with WM_SETTEXT and
 * posts IDOK to the dialog. It never uses the foreground window, never moves
 * the mouse, never types into the desktop, and reports success only when the
 * window title shows the watcher's " [MCP]" marker. Verified on SP18 P5
 * 2026-10-17: the hidden menu item runs without any menu opening on screen.
 */
export interface AttachAutomationResult {
    ok: boolean;
    /** Where it ended: done, already, probe, or the failing step (modal, menu-tools, file-dialog, ...). */
    stage: string;
    message: string;
    /** CODESYS main window title at the end. */
    title: string;
    /** How each menu step was matched (tools:name, execute:position, press:direct, ...). */
    matchedBy: string[];
    /** Top-level menu names found. */
    menu: string[];
}
export interface RunResult {
    code: number | null;
    stdout: string;
    stderr: string;
}
/** Runs the helper; injectable so tests never start PowerShell. */
export type HelperRunner = (args: string[], timeoutMs: number) => Promise<RunResult>;
export declare function attachHelperPath(): string;
export declare const defaultHelperRunner: HelperRunner;
/** The helper prints one JSON line; anything else is a failure with the raw output in the message. */
export declare function parseHelperOutput(run: RunResult): AttachAutomationResult;
export interface AttachAutomationOptions {
    /** How long the helper waits for the [MCP] title marker after the script ran. Default 60 s. */
    timeoutSeconds?: number;
    /** Only find the menu path; run nothing. */
    probeOnly?: boolean;
    runner?: HelperRunner;
    platform?: NodeJS.Platform;
}
/** Run the attach script in the CODESYS with this PID (and no other). */
export declare function runAttachAutomation(pid: number, scriptPath: string, opts?: AttachAutomationOptions): Promise<AttachAutomationResult>;
/** One line for a tool reply. */
export declare function describeAutomation(r: AttachAutomationResult): string;
/** A CODESYS the automation may target: opened by hand, of an installed version. */
export interface AttachCandidate {
    pid: number;
    /** Install label (e.g. "SP21 Patch 5"). */
    label: string;
    title: string;
}
export type AutoAttachOutcome = {
    kind: 'attached';
    pid: number;
    label: string;
    automation: AttachAutomationResult;
} | {
    kind: 'failed';
    pid: number;
    label: string;
    automation: AttachAutomationResult;
} | {
    kind: 'choose';
    candidates: AttachCandidate[];
} | {
    kind: 'not-candidate';
    pid: number;
    candidates: AttachCandidate[];
} | {
    kind: 'none';
};
export interface AutoAttachDeps {
    candidates: AttachCandidate[];
    /** Only this CODESYS; required when there are several candidates. */
    pid?: number;
    /** Runs the helper against one PID. */
    automate: (pid: number) => Promise<AttachAutomationResult>;
    /** Takes over the attach session the script made; returns the CODESYS PID or null. */
    pickUp: (c: AttachCandidate) => Promise<number | null>;
}
/**
 * Decide which CODESYS to attach automatically, run the helper on that one
 * only, and take over the session it made. Never guesses between several
 * CODESYS: the user picks (pid).
 */
export declare function autoAttach(d: AutoAttachDeps): Promise<AutoAttachOutcome>;
export declare function formatCandidates(cs: AttachCandidate[]): string;
//# sourceMappingURL=attach-uia.d.ts.map