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
exports.corsWrapper = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
// Helper to wrap callable functions as HTTP functions with proper CORS
const corsWrapper = (handler) => {
    return (0, https_1.onRequest)({ cors: true, region: 'us-central1' }, async (req, res) => {
        // Handle preflight OPTIONS request
        if (req.method === 'OPTIONS') {
            res.set('Access-Control-Allow-Origin', '*');
            res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
            res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            res.set('Access-Control-Max-Age', '86400');
            res.status(204).send('');
            return;
        }
        // Set CORS headers for main request
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
        }
        try {
            // Verify Firebase auth token
            let auth = null;
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const idToken = authHeader.split('Bearer ')[1];
                try {
                    auth = await admin.auth().verifyIdToken(idToken);
                }
                catch (error) {
                    res.status(401).json({ error: { message: 'Unauthorized', code: 'unauthenticated' } });
                    return;
                }
            }
            // Call the actual handler
            const { data } = req.body;
            const result = await handler(data || {}, auth);
            res.status(200).json({ result });
        }
        catch (error) {
            if (error instanceof https_1.HttpsError) {
                res.status(400).json({ error: { message: error.message, code: error.code } });
            }
            else {
                console.error('Function error:', error);
                res.status(500).json({ error: { message: 'Internal server error', code: 'internal' } });
            }
        }
    });
};
exports.corsWrapper = corsWrapper;
//# sourceMappingURL=cors-wrapper.js.map