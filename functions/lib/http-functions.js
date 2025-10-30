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
exports.joinGameHTTP = exports.createGameHTTP = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const jwt = __importStar(require("jsonwebtoken"));
const uuid_1 = require("uuid");
// Initialize admin if not already done
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.database();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';
// CORS configuration
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '3600',
};
function generateCode(length = 4) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
// Create Game HTTP Function
exports.createGameHTTP = (0, https_1.onRequest)({ region: 'us-central1' }, async (req, res) => {
    // Set CORS headers
    Object.entries(corsHeaders).forEach(([key, value]) => {
        res.set(key, value);
    });
    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        // Verify auth token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: { message: 'Unauthorized', code: 'unauthenticated' } });
            return;
        }
        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        // Create game logic
        const gameId = (0, uuid_1.v4)();
        const gameCode = generateCode(4);
        const accessoryCode = generateCode(4);
        await db.ref(`games/${gameId}`).set({
            status: 'LOBBY',
            host_uid: decodedToken.uid,
            code: gameCode,
            accessory_code: accessoryCode,
            created_at: Date.now(),
            config: {
                impostors: 1,
                snitches: 0,
                sabotage_duration_ms: 30000,
                meeting_duration_ms: 120000,
                voting_duration_ms: 45000,
                sabotage_cd_ms: 60000,
                meeting_cd_ms: 90000,
                task_pool_size: 10,
                tasks_per_player: 5,
                allow_task_dupes: false,
                phys_dig_ratio: { physical: 60, digital: 40 },
                ghost_tasks_enabled: true,
                voting: { allow_abstain: true, tie_policy: 'NO_EJECT' },
                audio: { hard_cap_ms: 60000 }
            },
            interrupts: { active: null },
            winner: null,
            timers: { server_ts: Date.now() }
        });
        res.status(200).json({ result: { gameId, gameCode, accessoryCode } });
    }
    catch (error) {
        console.error('Error creating game:', error);
        res.status(500).json({ error: { message: error.message || 'Internal error', code: 'internal' } });
    }
});
// Join Game HTTP Function
exports.joinGameHTTP = (0, https_1.onRequest)({ region: 'us-central1' }, async (req, res) => {
    // Set CORS headers
    Object.entries(corsHeaders).forEach(([key, value]) => {
        res.set(key, value);
    });
    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        // Verify auth token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: { message: 'Unauthorized', code: 'unauthenticated' } });
            return;
        }
        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const { data } = req.body;
        const { gameCode, nickname, deviceId } = data || {};
        if (!gameCode || !nickname || !deviceId) {
            res.status(400).json({ error: { message: 'Missing required fields', code: 'invalid-argument' } });
            return;
        }
        // Find game by code
        const gamesSnapshot = await db.ref('games').orderByChild('code').equalTo(gameCode).once('value');
        const games = gamesSnapshot.val();
        if (!games) {
            res.status(404).json({ error: { message: 'Game not found', code: 'not-found' } });
            return;
        }
        const gameId = Object.keys(games)[0];
        const game = games[gameId];
        if (game.status !== 'LOBBY') {
            res.status(400).json({ error: { message: 'Game already started', code: 'failed-precondition' } });
            return;
        }
        const playerId = decodedToken.uid;
        const rejoinToken = jwt.sign({ gameId, playerId }, JWT_SECRET);
        await db.ref(`players/${gameId}/${playerId}`).set({
            uid: playerId,
            nickname,
            role: 'CREWMATE',
            alive: true,
            device_id: deviceId,
            rejoin_token: rejoinToken,
            joined_at: Date.now(),
            last_seen: Date.now(),
            cooldowns: {}
        });
        res.status(200).json({ result: { playerId, rejoinToken, gameId } });
    }
    catch (error) {
        console.error('Error joining game:', error);
        res.status(500).json({ error: { message: error.message || 'Internal error', code: 'internal' } });
    }
});
//# sourceMappingURL=http-functions.js.map