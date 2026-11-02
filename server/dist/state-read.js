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
exports.FRESHNESS_MS = void 0;
exports.readSelection = readSelection;
const fs = __importStar(require("fs"));
exports.FRESHNESS_MS = 60000;
async function readSelection(filePath) {
    let text;
    try {
        text = await fs.promises.readFile(filePath, 'utf8');
    }
    catch {
        return { status: 'missing' };
    }
    let parsed;
    try {
        parsed = JSON.parse(text);
    }
    catch (err) {
        return { status: 'invalid', reason: err.message };
    }
    if (parsed.version !== 1) {
        return { status: 'invalid', reason: `unsupported version ${parsed.version}` };
    }
    const ageMs = Date.now() - new Date(parsed.updated_at).getTime();
    if (Number.isNaN(ageMs) || ageMs > exports.FRESHNESS_MS) {
        return { status: 'stale' };
    }
    return { status: 'ok', payload: parsed };
}
//# sourceMappingURL=state-read.js.map