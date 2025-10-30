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

// Start Game HTTP Function
export const startGameHTTP = onRequest({ region: 'us-central1' }, async (req, res) => {
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
    const { gameId } = data || {};

    if (!gameId) {
      res.status(400).json({ error: { message: 'Missing gameId', code: 'invalid-argument' } });
      return;
    }

    const gameSnapshot = await db.ref(`games/${gameId}`).once('value');
    const game = gameSnapshot.val();

    if (!game) {
      res.status(404).json({ error: { message: 'Game not found', code: 'not-found' } });
      return;
    }

    if (game.host_uid !== decodedToken.uid) {
      res.status(403).json({ error: { message: 'Only host can start', code: 'permission-denied' } });
      return;
    }

    if (game.status !== 'LOBBY') {
      res.status(400).json({ error: { message: 'Game already started', code: 'failed-precondition' } });
      return;
    }

    const playersSnapshot = await db.ref(`players/${gameId}`).once('value');
    const players = playersSnapshot.val() || {};
    const playerIds = Object.keys(players);

    if (playerIds.length < 3) {
      res.status(400).json({ error: { message: 'Need at least 3 players', code: 'failed-precondition' } });
      return;
    }

    console.log(`Starting game ${gameId} with ${playerIds.length} players`);

    const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
    const impostorCount = Math.min(game.config.impostors, Math.floor(playerIds.length / 3));
    const snitchCount = Math.min(game.config.snitches, playerIds.length - impostorCount - 1);

    const updates: any = {};

    // Assign roles
    for (let i = 0; i < playerIds.length; i++) {
      const playerId = shuffled[i];
      let role: 'IMPOSTOR' | 'SNITCH' | 'CREWMATE';

      if (i < impostorCount) {
        role = 'IMPOSTOR';
      } else if (i < impostorCount + snitchCount) {
        role = 'SNITCH';
      } else {
        role = 'CREWMATE';
      }

      updates[`players/${gameId}/${playerId}/role`] = role;
    }

    // Create tasks
    const allTasks: any[] = [];
    const physicalCount = Math.floor(game.config.task_pool_size * game.config.phys_dig_ratio.physical / 100);
    const digitalCount = game.config.task_pool_size - physicalCount;

    const physicalTasks = [
      { label: 'Throw 3 paper balls into trash', type: 'PHYSICAL', qr_id: 'qr_001', location: 'Cafeteria' },
      { label: 'Do 10 pushups', type: 'PHYSICAL', qr_id: 'qr_002', location: 'Gym' },
      { label: 'Stack 5 cups', type: 'PHYSICAL', qr_id: 'qr_003', location: 'Kitchen' },
      { label: 'Find the hidden key', type: 'PHYSICAL', qr_id: 'qr_004', location: 'Storage' },
      { label: 'Water the plant', type: 'PHYSICAL', qr_id: 'qr_005', location: 'Greenhouse' },
      { label: 'Take out the trash', type: 'PHYSICAL', qr_id: 'qr_006', location: 'Hallway' },
    ];

    const digitalTasks = [
      { label: 'Complete wire matching', type: 'DIGITAL', mini_id: 'mg_wires' },
      { label: 'Test your reaction time', type: 'DIGITAL', mini_id: 'mg_reaction' },
      { label: 'Solve the puzzle', type: 'DIGITAL', mini_id: 'mg_puzzle' },
      { label: 'Memory match', type: 'DIGITAL', mini_id: 'mg_memory' },
    ];

    for (let i = 0; i < physicalCount && i < physicalTasks.length; i++) {
      const taskId = `task_${String(i).padStart(3, '0')}`;
      allTasks.push({ ...physicalTasks[i], id: taskId });
      updates[`tasks/${gameId}/${taskId}`] = physicalTasks[i];
    }

    for (let i = 0; i < digitalCount && i < digitalTasks.length; i++) {
      const taskId = `task_${String(physicalCount + i).padStart(3, '0')}`;
      allTasks.push({ ...digitalTasks[i], id: taskId });
      updates[`tasks/${gameId}/${taskId}`] = digitalTasks[i];
    }

    // Assign tasks to players
    for (const playerId of playerIds) {
      const playerTasks = [...allTasks].sort(() => Math.random() - 0.5).slice(0, game.config.tasks_per_player);
      for (const task of playerTasks) {
        updates[`assignments/${gameId}/${playerId}/${task.id}`] = { status: 'PENDING' };
      }
    }

    updates[`games/${gameId}/status`] = 'RUNNING';
    await db.ref().update(updates);

    console.log('Game started successfully');
    res.status(200).json({ result: { success: true } });
  } catch (error: any) {
    console.error('Error starting game:', error);
    res.status(500).json({ error: { message: error.message || 'Internal error', code: 'internal' } });
  }
});