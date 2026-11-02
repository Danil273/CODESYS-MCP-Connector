"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeLiveValues = writeLiveValues;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
/**
 * Server-side counterpart to the TUI's readLiveValues.
 *
 * Wraps the caller's payload in the v1 envelope, writes atomically via
 * `<file>.<pid>.tmp` + rename, and creates parent dirs as needed. Mirrors
 * src/tui/shared/state-write.ts (the selection writer); kept separate
 * because that one's ESM and the server is CJS.
 */
async function writeLiveValues(filePath, projectDir, payload) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const envelope = {
        version: 1,
        updated_at: new Date().toISOString(),
        project_dir: projectDir,
        device: payload.device,
        pou_name: payload.pou_name,
        values: payload.values,
    };
    const tmp = `${filePath}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(envelope, null, 2), 'utf8');
    await fs.rename(tmp, filePath);
}
//# sourceMappingURL=live-values-write.js.map