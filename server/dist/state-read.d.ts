export declare const FRESHNESS_MS = 60000;
export interface SelectionPayload {
    version: 1;
    updated_at: string;
    project_dir: string;
    device: string;
    selection: {
        kind: string;
        name: string;
        path: string;
        abs_path: string;
    };
    viewer_line: number;
}
export type ReadResult = {
    status: 'ok';
    payload: SelectionPayload;
} | {
    status: 'missing';
} | {
    status: 'stale';
} | {
    status: 'invalid';
    reason: string;
};
export declare function readSelection(filePath: string): Promise<ReadResult>;
//# sourceMappingURL=state-read.d.ts.map