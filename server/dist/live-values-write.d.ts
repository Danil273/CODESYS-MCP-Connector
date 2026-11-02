export interface LiveValueSnapshotIn {
    value: string;
    type?: string;
    ts: number;
}
export interface LiveValuesPayloadIn {
    device: string;
    pou_name: string;
    values: Record<string, LiveValueSnapshotIn>;
}
/**
 * Server-side counterpart to the TUI's readLiveValues.
 *
 * Wraps the caller's payload in the v1 envelope, writes atomically via
 * `<file>.<pid>.tmp` + rename, and creates parent dirs as needed. Mirrors
 * src/tui/shared/state-write.ts (the selection writer); kept separate
 * because that one's ESM and the server is CJS.
 */
export declare function writeLiveValues(filePath: string, projectDir: string, payload: LiveValuesPayloadIn): Promise<void>;
//# sourceMappingURL=live-values-write.d.ts.map