import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

admin.initializeApp();

// Export HTTP functions with proper CORS
export { createGameHTTP, joinGameHTTP } from './http-functions';

const db = admin.database();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

// Configure CORS to allow requests from Vercel deployments and localhost
const corsOptions = {
  cors: true,  // Allow all origins for now, we'll restrict later if needed
  region: 'us-central1'
};

function generateCode(length: number = 4): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export const createGame = onCall(corsOptions, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');

  const gameId = uuidv4();
  const gameCode = generateCode(4);
  const accessoryCode = generateCode(4);

  await db.ref(`games/${gameId}`).set({
    status: 'LOBBY',
    host_uid: request.auth.uid,
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

  return { gameId, gameCode, accessoryCode };
});

export const joinGame = onCall(corsOptions, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');

  const { gameCode, nickname, deviceId } = request.data;
  if (!gameCode || !nickname || !deviceId) {
    throw new HttpsError('invalid-argument', 'Missing required fields');
  }

  const gamesSnapshot = await db.ref('games').orderByChild('code').equalTo(gameCode).once('value');
  const games = gamesSnapshot.val();
  if (!games) throw new HttpsError('not-found', 'Game not found');

  const gameId = Object.keys(games)[0];
  const game = games[gameId];

  if (game.status !== 'LOBBY') {
    throw new HttpsError('failed-precondition', 'Game already started');
  }

  const playerId = request.auth.uid;
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

  return { playerId, rejoinToken, gameId };
});

export const joinAccessory = onCall(corsOptions, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');

  const { accessoryCode, role } = request.data;
  if (!accessoryCode || !role || !['MASTER', 'SLAVE'].includes(role)) {
    throw new HttpsError('invalid-argument', 'Invalid parameters');
  }

  const gamesSnapshot = await db.ref('games').orderByChild('accessory_code').equalTo(accessoryCode).once('value');
  const games = gamesSnapshot.val();
  if (!games) throw new HttpsError('not-found', 'Game not found');

  const gameId = Object.keys(games)[0];
  const accessoryId = uuidv4();

  await db.ref(`accessories/${gameId}/${accessoryId}`).set({
    role,
    connected: true,
    last_seen: Date.now()
  });

  return { accessoryId, gameId };
});

export const startGame = onCall(corsOptions, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');

  const { gameId } = request.data;
  if (!gameId) throw new HttpsError('invalid-argument', 'Missing gameId');

  const gameSnapshot = await db.ref(`games/${gameId}`).once('value');
  const game = gameSnapshot.val();

  if (!game) throw new HttpsError('not-found', 'Game not found');
  if (game.host_uid !== request.auth.uid) {
    throw new HttpsError('permission-denied', 'Only host can start');
  }
  if (game.status !== 'LOBBY') {
    throw new HttpsError('failed-precondition', 'Game already started');
  }

  const playersSnapshot = await db.ref(`players/${gameId}`).once('value');
  const players = playersSnapshot.val() || {};
  const playerIds = Object.keys(players);

  if (playerIds.length < 3) {
    throw new HttpsError('failed-precondition', 'Need at least 3 players');
  }

  const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
  const impostorCount = Math.min(game.config.impostors, Math.floor(playerIds.length / 3));
  const snitchCount = Math.min(game.config.snitches, playerIds.length - impostorCount - 1);

  const updates: any = {};

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

  for (const playerId of playerIds) {
    const playerTasks = [...allTasks].sort(() => Math.random() - 0.5).slice(0, game.config.tasks_per_player);
    for (const task of playerTasks) {
      updates[`assignments/${gameId}/${playerId}/${task.id}`] = { status: 'PENDING' };
    }
  }

  updates[`games/${gameId}/status`] = 'RUNNING';
  await db.ref().update(updates);

  return { success: true };
});

export const endGame = onCall(corsOptions, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');

  const { gameId } = request.data;
  if (!gameId) throw new HttpsError('invalid-argument', 'Missing gameId');

  const gameSnapshot = await db.ref(`games/${gameId}`).once('value');
  const game = gameSnapshot.val();

  if (!game) throw new HttpsError('not-found', 'Game not found');
  if (game.host_uid !== request.auth.uid) {
    throw new HttpsError('permission-denied', 'Only host can end');
  }

  await db.ref(`games/${gameId}`).update({
    status: 'ENDED',
    winner: 'NONE'
  });

  return { success: true };
});

export const submitProof = onCall(corsOptions, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');

  const { gameId, taskId, proofUrl } = request.data;
  if (!gameId || !taskId || !proofUrl) {
    throw new HttpsError('invalid-argument', 'Missing required fields');
  }

  const playerId = request.auth.uid;
  await db.ref(`assignments/${gameId}/${playerId}/${taskId}`).update({
    status: 'COMPLETE',
    proof_url: proofUrl,
    completed_at: Date.now()
  });

  return { success: true };
});

export const completeTask = onCall(corsOptions, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');

  const { gameId, taskId, score } = request.data;
  if (!gameId || !taskId) {
    throw new HttpsError('invalid-argument', 'Missing required fields');
  }

  const playerId = request.auth.uid;
  await db.ref(`assignments/${gameId}/${playerId}/${taskId}`).update({
    status: 'COMPLETE',
    score: score || 0,
    completed_at: Date.now()
  });

  const assignmentsSnapshot = await db.ref(`assignments/${gameId}/${playerId}`).once('value');
  const assignments = assignmentsSnapshot.val() || {};
  const totalTasks = Object.keys(assignments).length;
  const completedTasks = Object.values(assignments).filter((a: any) => a.status === 'COMPLETE').length;

  if (completedTasks === totalTasks) {
    const playerSnapshot = await db.ref(`players/${gameId}/${playerId}`).once('value');
    const player = playerSnapshot.val();

    if (player && player.role === 'SNITCH') {
      await db.ref(`games/${gameId}`).update({
        status: 'ENDED',
        winner: 'SNITCH'
      });
    }
  }

  return { success: true };
});

export const startSabotage = onCall(corsOptions, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');

  const { gameId, sabotageType } = request.data;
  if (!gameId || !sabotageType) {
    throw new HttpsError('invalid-argument', 'Missing required fields');
  }

  const playerId = request.auth.uid;
  const playerSnapshot = await db.ref(`players/${gameId}/${playerId}`).once('value');
  const player = playerSnapshot.val();

  if (!player || player.role !== 'IMPOSTOR') {
    throw new HttpsError('permission-denied', 'Only impostors can sabotage');
  }

  const now = Date.now();
  if (player.cooldowns?.sabotage_ready_at && now < player.cooldowns.sabotage_ready_at) {
    throw new HttpsError('failed-precondition', 'Sabotage on cooldown');
  }

  const gameSnapshot = await db.ref(`games/${gameId}`).once('value');
  const game = gameSnapshot.val();

  if (game.interrupts?.active) {
    throw new HttpsError('failed-precondition', 'Another interrupt is active');
  }

  const sabotageId = uuidv4();
  const duration = game.config.sabotage_duration_ms;

  await db.ref().update({
    [`games/${gameId}/interrupts/active`]: {
      id: sabotageId,
      type: 'SABOTAGE',
      started_at: now,
      ends_at: now + duration
    },
    [`players/${gameId}/${playerId}/cooldowns/sabotage_ready_at`]: now + game.config.sabotage_cd_ms
  });

  setTimeout(async () => {
    const currentInterruptSnapshot = await db.ref(`games/${gameId}/interrupts/active`).once('value');
    const currentInterrupt = currentInterruptSnapshot.val();

    if (currentInterrupt?.id === sabotageId) {
      await db.ref().update({
        [`games/${gameId}/interrupts/active`]: null,
        [`games/${gameId}/status`]: 'ENDED',
        [`games/${gameId}/winner`]: 'IMPOSTORS'
      });
    }
  }, duration);

  return { success: true };
});

export const resolveSabotage = onCall(corsOptions, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');

  const { gameId } = request.data;
  if (!gameId) throw new HttpsError('invalid-argument', 'Missing gameId');

  const gameSnapshot = await db.ref(`games/${gameId}`).once('value');
  const game = gameSnapshot.val();

  if (!game?.interrupts?.active || game.interrupts.active.type !== 'SABOTAGE') {
    throw new HttpsError('failed-precondition', 'No active sabotage');
  }

  await db.ref(`games/${gameId}/interrupts/active`).set(null);

  return { success: true };
});

export const callMeeting = onCall(corsOptions, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');

  const { gameId } = request.data;
  if (!gameId) throw new HttpsError('invalid-argument', 'Missing gameId');

  const playerId = request.auth.uid;
  const playerSnapshot = await db.ref(`players/${gameId}/${playerId}`).once('value');
  const player = playerSnapshot.val();

  if (!player || !player.alive) {
    throw new HttpsError('permission-denied', 'Only alive players can call meetings');
  }

  const now = Date.now();
  if (player.cooldowns?.meeting_ready_at && now < player.cooldowns.meeting_ready_at) {
    throw new HttpsError('failed-precondition', 'Meeting on cooldown');
  }

  const gameSnapshot = await db.ref(`games/${gameId}`).once('value');
  const game = gameSnapshot.val();

  if (game.interrupts?.active) {
    throw new HttpsError('failed-precondition', 'Another interrupt is active');
  }

  const meetingId = uuidv4();
  const discussionDuration = game.config.meeting_duration_ms;
  const votingDuration = game.config.voting_duration_ms;

  await db.ref().update({
    [`games/${gameId}/interrupts/active`]: {
      id: meetingId,
      type: 'MEETING',
      started_at: now,
      ends_at: now + discussionDuration + votingDuration
    },
    [`meetings/${gameId}/${meetingId}`]: {
      status: 'OPEN',
      started_at: now,
      ends_at: now + discussionDuration + votingDuration,
      votes: {}
    },
    [`players/${gameId}/${playerId}/cooldowns/meeting_ready_at`]: now + game.config.meeting_cd_ms
  });

  setTimeout(async () => {
    const currentInterruptSnapshot = await db.ref(`games/${gameId}/interrupts/active`).once('value');
    const currentInterrupt = currentInterruptSnapshot.val();

    if (currentInterrupt?.id === meetingId) {
      await resolveMeeting(gameId, meetingId);
    }
  }, discussionDuration + votingDuration);

  return { success: true, meetingId };
});

export const vote = onCall(corsOptions, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');

  const { gameId, meetingId, targetPlayerId } = request.data;
  if (!gameId || !meetingId) {
    throw new HttpsError('invalid-argument', 'Missing required fields');
  }

  const playerId = request.auth.uid;
  const playerSnapshot = await db.ref(`players/${gameId}/${playerId}`).once('value');
  const player = playerSnapshot.val();

  if (!player || !player.alive) {
    throw new HttpsError('permission-denied', 'Only alive players can vote');
  }

  const meetingSnapshot = await db.ref(`meetings/${gameId}/${meetingId}`).once('value');
  const meeting = meetingSnapshot.val();

  if (!meeting || meeting.status !== 'OPEN') {
    throw new HttpsError('failed-precondition', 'Meeting is not open for voting');
  }

  await db.ref(`meetings/${gameId}/${meetingId}/votes/${playerId}`).set({
    target: targetPlayerId || null,
    ts: Date.now()
  });

  return { success: true };
});

export const skipVote = onCall(corsOptions, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');

  const { gameId, meetingId } = request.data;
  if (!gameId || !meetingId) {
    throw new HttpsError('invalid-argument', 'Missing required fields');
  }

  const playerId = request.auth.uid;
  await db.ref(`meetings/${gameId}/${meetingId}/votes/${playerId}`).set({
    target: null,
    ts: Date.now()
  });

  return { success: true };
});

async function resolveMeeting(gameId: string, meetingId: string) {
  const meetingSnapshot = await db.ref(`meetings/${gameId}/${meetingId}`).once('value');
  const meeting = meetingSnapshot.val();

  if (!meeting || meeting.status !== 'OPEN') return;

  const playersSnapshot = await db.ref(`players/${gameId}`).once('value');
  const players = playersSnapshot.val() || {};

  const alivePlayers = Object.entries(players).filter(([_, p]: any) => p.alive);
  const voteCounts: { [key: string]: number } = {};
  let skipCount = 0;

  for (const [voterId, vote] of Object.entries(meeting.votes || {})) {
    const voter = players[voterId];
    if (!voter?.alive) continue;

    const target = (vote as any).target;
    if (target === null) {
      skipCount++;
    } else {
      voteCounts[target] = (voteCounts[target] || 0) + 1;
    }
  }

  let ejectedPlayerId: string | undefined;
  let reason: string;

  const gameSnapshot = await db.ref(`games/${gameId}`).once('value');
  const game = gameSnapshot.val();

  if (Object.keys(voteCounts).length === 0 || skipCount >= Math.max(...Object.values(voteCounts), 0)) {
    reason = 'TIE_NO_EJECT';
  } else {
    const topVotes = Math.max(...Object.values(voteCounts));
    const tiedPlayers = Object.entries(voteCounts).filter(([_, count]) => count === topVotes).map(([id]) => id);

    if (tiedPlayers.length === 1) {
      ejectedPlayerId = tiedPlayers[0];
      reason = 'MAJORITY';
    } else if (game.config.voting.tie_policy === 'RANDOM_TOP') {
      ejectedPlayerId = tiedPlayers[Math.floor(Math.random() * tiedPlayers.length)];
      reason = 'RANDOM_TOP';
    } else {
      reason = 'TIE_NO_EJECT';
    }
  }

  const updates: any = {
    [`meetings/${gameId}/${meetingId}/status`]: 'RESOLVED',
    [`meetings/${gameId}/${meetingId}/result`]: {
      ejected_player_id: ejectedPlayerId,
      reason
    },
    [`games/${gameId}/interrupts/active`]: null
  };

  if (ejectedPlayerId) {
    updates[`players/${gameId}/${ejectedPlayerId}/alive`] = false;

    const ejectedPlayer = players[ejectedPlayerId];
    const remainingImpostors = alivePlayers.filter(([_, p]: any) => p.role === 'IMPOSTOR' && p.alive).length - (ejectedPlayer.role === 'IMPOSTOR' ? 1 : 0);
    const remainingCrewmates = alivePlayers.filter(([_, p]: any) => p.role !== 'IMPOSTOR' && p.alive).length - (ejectedPlayer.role !== 'IMPOSTOR' ? 1 : 0);

    if (remainingImpostors === 0) {
      updates[`games/${gameId}/status`] = 'ENDED';
      updates[`games/${gameId}/winner`] = 'CREWMATES';
    } else if (remainingImpostors >= remainingCrewmates) {
      updates[`games/${gameId}/status`] = 'ENDED';
      updates[`games/${gameId}/winner`] = 'IMPOSTORS';
    }
  }

  await db.ref().update(updates);
}

export const updateGameConfig = onCall(corsOptions, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');

  const { gameId, config } = request.data;
  if (!gameId || !config) {
    throw new HttpsError('invalid-argument', 'Missing required fields');
  }

  const gameSnapshot = await db.ref(`games/${gameId}`).once('value');
  const game = gameSnapshot.val();

  if (!game) throw new HttpsError('not-found', 'Game not found');
  if (game.host_uid !== request.auth.uid) {
    throw new HttpsError('permission-denied', 'Only host can update config');
  }
  if (game.status !== 'LOBBY') {
    throw new HttpsError('failed-precondition', 'Cannot update config after game started');
  }

  await db.ref(`games/${gameId}/config`).update(config);

  return { success: true };
});