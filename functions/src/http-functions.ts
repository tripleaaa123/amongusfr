import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

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

function generateCode(length: number = 4): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Create Game HTTP Function
export const createGameHTTP = onRequest({ region: 'us-central1' }, async (req, res) => {
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
    const gameId = uuidv4();
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

    // Also add host as first player
    console.log('Creating host player for game:', gameId, 'uid:', decodedToken.uid);
    try {
      await db.ref(`players/${gameId}/${decodedToken.uid}`).set({
        uid: decodedToken.uid,
        nickname: 'Host',
        role: 'CREWMATE',
        alive: true,
        device_id: 'host-device',
        rejoin_token: jwt.sign({ gameId, playerId: decodedToken.uid }, JWT_SECRET),
        joined_at: Date.now(),
        last_seen: Date.now(),
        cooldowns: {}
      });
      console.log('Host player created successfully');
    } catch (playerError: any) {
      console.error('Failed to create host player:', playerError);
    }

    res.status(200).json({ result: { gameId, gameCode, accessoryCode, playerId: decodedToken.uid } });
  } catch (error: any) {
    console.error('Error creating game:', error);
    res.status(500).json({ error: { message: error.message || 'Internal error', code: 'internal' } });
  }
});

// Join Game HTTP Function
export const joinGameHTTP = onRequest({ region: 'us-central1' }, async (req, res) => {
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
    console.log('Looking for game with code:', gameCode);
    const gamesSnapshot = await db.ref('games').orderByChild('code').equalTo(gameCode).once('value');
    const games = gamesSnapshot.val();
    console.log('Found games:', games ? Object.keys(games) : 'none');

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

    console.log('Adding player to game:', gameId, 'player:', playerId, 'nickname:', nickname);
    try {
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
      console.log('Player added successfully');
    } catch (playerError: any) {
      console.error('Failed to add player:', playerError);
      throw playerError;
    }

    res.status(200).json({ result: { playerId, rejoinToken, gameId } });
  } catch (error: any) {
    console.error('Error joining game:', error);
    res.status(500).json({ error: { message: error.message || 'Internal error', code: 'internal' } });
  }
});

// Join Accessory HTTP Function
export const joinAccessoryHTTP = onRequest({ region: 'us-central1' }, async (req, res) => {
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
    await admin.auth().verifyIdToken(idToken);

    const { data } = req.body;
    const { accessoryCode, role } = data || {};

    if (!accessoryCode || !role || !['MASTER', 'SLAVE'].includes(role)) {
      res.status(400).json({ error: { message: 'Invalid parameters', code: 'invalid-argument' } });
      return;
    }

    // Find game by accessory_code (note the underscore!)
    const gamesSnapshot = await db.ref('games').orderByChild('accessory_code').equalTo(accessoryCode).once('value');
    const games = gamesSnapshot.val();

    console.log('Looking for accessory code:', accessoryCode);
    console.log('Found games:', games);

    if (!games) {
      res.status(404).json({ error: { message: 'Game not found', code: 'not-found' } });
      return;
    }

    const gameId = Object.keys(games)[0];
    const accessoryId = uuidv4();

    await db.ref(`accessories/${gameId}/${accessoryId}`).set({
      role,
      connected: true,
      last_seen: Date.now()
    });

    res.status(200).json({ result: { accessoryId, gameId } });
  } catch (error: any) {
    console.error('Error joining accessory:', error);
    res.status(500).json({ error: { message: error.message || 'Internal error', code: 'internal' } });
  }
});