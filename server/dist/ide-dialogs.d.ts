/**
 * Message boxes open in CODESYS before an online call.
 *
 * A modal box blocks every script the MCP sends: the online layer then fails
 * with "Stack empty" or the call hangs until its timeout. Seen 2026-10-17 on
 * a PLC behind a tunnel: a "No device is responding to the scan request" box
 * (left by a network scan) made create_online_application fail, and later a
 * "No connection to the device" box sat in the IDE after the tunnel dropped.
 *
 * Only boxes that report something and offer nothing to decide are answered
 * automatically, and only with the button that changes nothing. Any other
 * box stops the call with its text, so the user decides.
 */
export interface IdeDialog {
    hwnd: number;
    title: string;
    text: string;
    buttons: string[];
}
export interface DialogRule {
    /** Matched against the dialog text. */
    match: RegExp;
    /** The button to press; it must be one that changes nothing. */
    button: string;
    why: string;
}
export declare const AUTO_ANSWER: DialogRule[];
export interface DialogPlan {
    answer: Array<{
        dialog: IdeDialog;
        rule: DialogRule;
    }>;
    blocking: IdeDialog[];
}
export declare function planDialogs(dialogs: IdeDialog[], rules?: DialogRule[]): DialogPlan;
export interface RunResult {
    code: number | null;
    stdout: string;
    stderr: string;
}
/** Runs the helper; injectable so tests never start PowerShell. */
export type DialogHelperRunner = (args: string[], timeoutMs: number) => Promise<RunResult>;
export declare function dialogHelperPath(): string;
export declare const defaultDialogRunner: DialogHelperRunner;
export declare function listDialogs(pid: number, run?: DialogHelperRunner): Promise<IdeDialog[] | null>;
export interface DialogCheck {
    /** Set when a box needs the user: the online call must not start. */
    block: string | null;
    /** What was answered automatically, for the reply. */
    answered: string[];
}
/**
 * Before an online call: answer the harmless boxes, refuse on any other.
 * A helper failure never blocks (the call then runs as before).
 */
export declare function clearIdeDialogs(pid: number | null, run?: DialogHelperRunner): Promise<DialogCheck>;
//# sourceMappingURL=ide-dialogs.d.ts.map