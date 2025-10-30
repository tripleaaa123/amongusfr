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
exports.commenceVoting = exports.selectWhoDied = exports.endGame = exports.completeSabotageMini = exports.completeDigitalTask = exports.scanQrAndStartTask = exports.resolveMeeting = exports.submitVote = exports.impostorMarkDead = exports.impostorSabotage = exports.playerCallMeeting = exports.startGame = exports.joinAccessory = exports.joinGame = exports.createGame = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const jwt = __importStar(require("jsonwebtoken"));
const uuid_1 = require("uuid");
admin.initializeApp();
const db = admin.database();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';
function generateCode(length = 4) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
exports.createGame = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    const gameId = (0, uuid_1.v4)();
    const gameCode = generateCode(4);
    const accessoryCode = generateCode(4);
    await db.ref(`games/${gameId}`).set({
        status: 'LOBBY',
        host_uid: context.auth.uid,
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
exports.joinGame = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    const { gameCode, nickname, deviceId } = data;
    if (!gameCode || !nickname || !deviceId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }
    const gamesSnapshot = await db.ref('games').orderByChild('code').equalTo(gameCode).once('value');
    const games = gamesSnapshot.val();
    if (!games)
        throw new functions.https.HttpsError('not-found', 'Game not found');
    const gameId = Object.keys(games)[0];
    const game = games[gameId];
    if (game.status !== 'LOBBY') {
        throw new functions.https.HttpsError('failed-precondition', 'Game already started');
    }
    const playerId = context.auth.uid;
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
exports.joinAccessory = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    const { accessoryCode, role } = data;
    if (!accessoryCode || !role || !['MASTER', 'SLAVE'].includes(role)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid parameters');
    }
    const gamesSnapshot = await db.ref('games').orderByChild('accessory_code').equalTo(accessoryCode).once('value');
    const games = gamesSnapshot.val();
    if (!games)
        throw new functions.https.HttpsError('not-found', 'Game not found');
    const gameId = Object.keys(games)[0];
    const accessoryId = (0, uuid_1.v4)();
    await db.ref(`accessories/${gameId}/${accessoryId}`).set({
        role,
        connected: true,
        last_seen: Date.now()
    });
    return { accessoryId, gameId };
});
exports.startGame = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    const { gameId } = data;
    if (!gameId)
        throw new functions.https.HttpsError('invalid-argument', 'Missing gameId');
    const gameSnapshot = await db.ref(`games/${gameId}`).once('value');
    const game = gameSnapshot.val();
    if (!game)
        throw new functions.https.HttpsError('not-found', 'Game not found');
    if (game.host_uid !== context.auth.uid) {
        throw new functions.https.HttpsError('permission-denied', 'Only host can start');
    }
    if (game.status !== 'LOBBY') {
        throw new functions.https.HttpsError('failed-precondition', 'Game already started');
    }
    const playersSnapshot = await db.ref(`players/${gameId}`).once('value');
    const players = playersSnapshot.val() || {};
    const playerIds = Object.keys(players);
    if (playerIds.length < 3) {
        throw new functions.https.HttpsError('failed-precondition', 'Need at least 3 players');
    }
    const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
    const impostorCount = Math.min(game.config.impostors, Math.floor(playerIds.length / 3));
    const snitchCount = Math.min(game.config.snitches, playerIds.length - impostorCount - 1);
    const updates = {};
    for (let i = 0; i < playerIds.length; i++) {
        const playerId = shuffled[i];
        let role;
        if (i < impostorCount) {
            role = 'IMPOSTOR';
        }
        else if (i < impostorCount + snitchCount) {
            role = 'SNITCH';
        }
        else {
            role = 'CREWMATE';
        }
        updates[`players/${gameId}/${playerId}/role`] = role;
    }
    const allTasks = [];
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
        allTasks.push(Object.assign(Object.assign({}, physicalTasks[i]), { id: taskId }));
        updates[`tasks/${gameId}/${taskId}`] = physicalTasks[i];
    }
    for (let i = 0; i < digitalCount && i < digitalTasks.length; i++) {
        const taskId = `task_${String(physicalCount + i).padStart(3, '0')}`;
        allTasks.push(Object.assign(Object.assign({}, digitalTasks[i]), { id: taskId }));
        updates[`tasks/${gameId}/${taskId}`] = digitalTasks[i];
    }
    for (const playerId of playerIds) {
        const playerTasks = [...allTasks].sort(() => Math.random() - 0.5).slice(0, game.config.tasks_per_player);
        for (const task of playerTasks) {
            updates[`assignments/${gameId}/${playerId}/${task.id}`] = {
                status: 'PENDING'
            };
        }
    }
    updates[`games/${gameId}/status`] = 'RUNNING';
    updates[`games/${gameId}/timers/server_ts`] = Date.now();
    await db.ref().update(updates);
    return { success: true };
});
exports.playerCallMeeting = functions.https.onCall(async (data, context) => {
    var _a;
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    const { gameId } = data;
    const playerId = context.auth.uid;
    const [gameSnapshot, playerSnapshot] = await Promise.all([
        db.ref(`games/${gameId}`).once('value'),
        db.ref(`players/${gameId}/${playerId}`).once('value')
    ]);
    const game = gameSnapshot.val();
    const player = playerSnapshot.val();
    if (!game || !player)
        throw new functions.https.HttpsError('not-found', 'Game or player not found');
    if (!player.alive)
        throw new functions.https.HttpsError('failed-precondition', 'Dead players cannot call meetings');
    if (game.interrupts.active)
        throw new functions.https.HttpsError('failed-precondition', 'Interrupt already active');
    const now = Date.now();
    if (((_a = player.cooldowns) === null || _a === void 0 ? void 0 : _a.meeting_ready_at) && player.cooldowns.meeting_ready_at > now) {
        throw new functions.https.HttpsError('failed-precondition', 'Meeting on cooldown');
    }
    const meetingId = (0, uuid_1.v4)();
    const ends_at = now + game.config.meeting_duration_ms;
    await db.ref().update({
        [`games/${gameId}/interrupts/active`]: {
            id: meetingId,
            type: 'MEETING',
            started_at: now,
            ends_at
        },
        [`meetings/${gameId}/${meetingId}`]: {
            status: 'OPEN',
            started_at: now,
            ends_at,
            votes: {}
        },
        [`players/${gameId}/${playerId}/cooldowns/meeting_ready_at`]: now + game.config.meeting_cd_ms
    });
    return { success: true, meetingId };
});
exports.impostorSabotage = functions.https.onCall(async (data, context) => {
    var _a;
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    const { gameId } = data;
    const playerId = context.auth.uid;
    const [gameSnapshot, playerSnapshot] = await Promise.all([
        db.ref(`games/${gameId}`).once('value'),
        db.ref(`players/${gameId}/${playerId}`).once('value')
    ]);
    const game = gameSnapshot.val();
    const player = playerSnapshot.val();
    if (!game || !player)
        throw new functions.https.HttpsError('not-found', 'Game or player not found');
    if (player.role !== 'IMPOSTOR')
        throw new functions.https.HttpsError('permission-denied', 'Only impostors can sabotage');
    if (!player.alive)
        throw new functions.https.HttpsError('failed-precondition', 'Dead players cannot sabotage');
    if (game.interrupts.active)
        throw new functions.https.HttpsError('failed-precondition', 'Interrupt already active');
    const now = Date.now();
    if (((_a = player.cooldowns) === null || _a === void 0 ? void 0 : _a.sabotage_ready_at) && player.cooldowns.sabotage_ready_at > now) {
        throw new functions.https.HttpsError('failed-precondition', 'Sabotage on cooldown');
    }
    const sabotageId = (0, uuid_1.v4)();
    const ends_at = now + game.config.sabotage_duration_ms;
    await db.ref().update({
        [`games/${gameId}/interrupts/active`]: {
            id: sabotageId,
            type: 'SABOTAGE',
            started_at: now,
            ends_at
        },
        [`players/${gameId}/${playerId}/cooldowns/sabotage_ready_at`]: now + game.config.sabotage_cd_ms
    });
    return { success: true, sabotageId };
});
exports.impostorMarkDead = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    const { gameId, victimPlayerId } = data;
    const playerId = context.auth.uid;
    const [playerSnapshot, victimSnapshot] = await Promise.all([
        db.ref(`players/${gameId}/${playerId}`).once('value'),
        db.ref(`players/${gameId}/${victimPlayerId}`).once('value')
    ]);
    const player = playerSnapshot.val();
    const victim = victimSnapshot.val();
    if (!player || !victim)
        throw new functions.https.HttpsError('not-found', 'Player not found');
    if (player.role !== 'IMPOSTOR')
        throw new functions.https.HttpsError('permission-denied', 'Only impostors can kill');
    if (!player.alive)
        throw new functions.https.HttpsError('failed-precondition', 'Dead players cannot kill');
    if (!victim.alive)
        throw new functions.https.HttpsError('failed-precondition', 'Player already dead');
    await db.ref(`players/${gameId}/${victimPlayerId}/alive`).set(false);
    await checkGameEnd(gameId);
    return { success: true };
});
exports.submitVote = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    const { gameId, meetingId, targetPlayerId } = data;
    const voterId = context.auth.uid;
    const [meetingSnapshot, voterSnapshot] = await Promise.all([
        db.ref(`meetings/${gameId}/${meetingId}`).once('value'),
        db.ref(`players/${gameId}/${voterId}`).once('value')
    ]);
    const meeting = meetingSnapshot.val();
    const voter = voterSnapshot.val();
    if (!meeting || !voter)
        throw new functions.https.HttpsError('not-found', 'Meeting or voter not found');
    if (meeting.status !== 'OPEN')
        throw new functions.https.HttpsError('failed-precondition', 'Voting closed');
    if (!voter.alive)
        throw new functions.https.HttpsError('failed-precondition', 'Dead players cannot vote');
    await db.ref(`meetings/${gameId}/${meetingId}/votes/${voterId}`).set({
        target: targetPlayerId,
        ts: Date.now()
    });
    return { success: true };
});
exports.resolveMeeting = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    const { gameId, meetingId } = data;
    const [gameSnapshot, meetingSnapshot] = await Promise.all([
        db.ref(`games/${gameId}`).once('value'),
        db.ref(`meetings/${gameId}/${meetingId}`).once('value')
    ]);
    const game = gameSnapshot.val();
    const meeting = meetingSnapshot.val();
    if (!game || !meeting)
        throw new functions.https.HttpsError('not-found', 'Game or meeting not found');
    if (meeting.status !== 'OPEN')
        throw new functions.https.HttpsError('failed-precondition', 'Meeting already resolved');
    const votes = meeting.votes || {};
    const voteCounts = {};
    let maxVotes = 0;
    let topPlayers = [];
    for (const vote of Object.values(votes)) {
        if (vote.target) {
            voteCounts[vote.target] = (voteCounts[vote.target] || 0) + 1;
            if (voteCounts[vote.target] > maxVotes) {
                maxVotes = voteCounts[vote.target];
                topPlayers = [vote.target];
            }
            else if (voteCounts[vote.target] === maxVotes) {
                topPlayers.push(vote.target);
            }
        }
    }
    let ejectedPlayerId;
    let reason;
    if (topPlayers.length === 0 || maxVotes === 0) {
        reason = 'TIE_NO_EJECT';
    }
    else if (topPlayers.length === 1) {
        ejectedPlayerId = topPlayers[0];
        reason = 'MAJORITY';
    }
    else {
        if (game.config.voting.tie_policy === 'RANDOM_TOP') {
            ejectedPlayerId = topPlayers[Math.floor(Math.random() * topPlayers.length)];
            reason = 'RANDOM_TOP';
        }
        else {
            reason = 'TIE_NO_EJECT';
        }
    }
    const updates = {
        [`meetings/${gameId}/${meetingId}/status`]: 'RESOLVED',
        [`meetings/${gameId}/${meetingId}/result`]: { ejected_player_id: ejectedPlayerId, reason },
        [`games/${gameId}/interrupts/active`]: null
    };
    if (ejectedPlayerId) {
        updates[`players/${gameId}/${ejectedPlayerId}/alive`] = false;
    }
    await db.ref().update(updates);
    await checkGameEnd(gameId);
    return { success: true, ejectedPlayerId, reason };
});
exports.scanQrAndStartTask = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    const { gameId, qrToken } = data;
    const playerId = context.auth.uid;
    let decoded;
    try {
        decoded = jwt.verify(qrToken, JWT_SECRET);
    }
    catch (error) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid QR token');
    }
    if (decoded.gameId !== gameId) {
        throw new functions.https.HttpsError('invalid-argument', 'QR for different game');
    }
    if (decoded.exp < Date.now()) {
        throw new functions.https.HttpsError('invalid-argument', 'QR token expired');
    }
    const [assignmentSnapshot, taskSnapshot] = await Promise.all([
        db.ref(`assignments/${gameId}/${playerId}/${decoded.taskId}`).once('value'),
        db.ref(`tasks/${gameId}/${decoded.taskId}`).once('value')
    ]);
    const assignment = assignmentSnapshot.val();
    const task = taskSnapshot.val();
    if (!assignment || !task)
        throw new functions.https.HttpsError('not-found', 'Task not assigned');
    if (assignment.status !== 'PENDING')
        throw new functions.https.HttpsError('failed-precondition', 'Task already complete');
    if (task.qr_id !== decoded.qrId)
        throw new functions.https.HttpsError('invalid-argument', 'Wrong QR for task');
    return {
        type: task.type,
        requiresPhoto: task.type === 'PHYSICAL',
        miniId: task.mini_id
    };
});
exports.completeDigitalTask = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    const { gameId, taskId, miniId, score } = data;
    const playerId = context.auth.uid;
    const [assignmentSnapshot, taskSnapshot] = await Promise.all([
        db.ref(`assignments/${gameId}/${playerId}/${taskId}`).once('value'),
        db.ref(`tasks/${gameId}/${taskId}`).once('value')
    ]);
    const assignment = assignmentSnapshot.val();
    const task = taskSnapshot.val();
    if (!assignment || !task)
        throw new functions.https.HttpsError('not-found', 'Task not found');
    if (assignment.status !== 'PENDING')
        throw new functions.https.HttpsError('failed-precondition', 'Task already complete');
    if (task.type !== 'DIGITAL')
        throw new functions.https.HttpsError('invalid-argument', 'Not a digital task');
    if (task.mini_id !== miniId)
        throw new functions.https.HttpsError('invalid-argument', 'Wrong mini game');
    const thresholds = {
        mg_reaction: 300,
        mg_wires: 20000,
        mg_puzzle: 30000,
        mg_memory: 25000
    };
    const threshold = thresholds[miniId] || 10000;
    if (score > threshold) {
        throw new functions.https.HttpsError('failed-precondition', 'Score too low');
    }
    await db.ref(`assignments/${gameId}/${playerId}/${taskId}`).update({
        status: 'COMPLETE',
        score,
        completed_at: Date.now()
    });
    await checkGameEnd(gameId);
    return { success: true };
});
exports.completeSabotageMini = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    const { gameId, interruptId, accessoryRole } = data;
    const gameSnapshot = await db.ref(`games/${gameId}`).once('value');
    const game = gameSnapshot.val();
    if (!game)
        throw new functions.https.HttpsError('not-found', 'Game not found');
    if (!game.interrupts.active || game.interrupts.active.id !== interruptId) {
        throw new functions.https.HttpsError('failed-precondition', 'Sabotage not active');
    }
    if (game.interrupts.active.type !== 'SABOTAGE') {
        throw new functions.https.HttpsError('invalid-argument', 'Not a sabotage');
    }
    const sabotageRef = db.ref(`sabotages/${gameId}/${interruptId}`);
    const sabotageSnapshot = await sabotageRef.once('value');
    const sabotage = sabotageSnapshot.val() || {};
    const updates = {};
    updates[`${accessoryRole}_complete`] = true;
    await sabotageRef.update(updates);
    const updatedSnapshot = await sabotageRef.once('value');
    const updated = updatedSnapshot.val();
    if ((updated === null || updated === void 0 ? void 0 : updated.MASTER_complete) && (updated === null || updated === void 0 ? void 0 : updated.SLAVE_complete)) {
        await db.ref(`games/${gameId}/interrupts/active`).set(null);
    }
    return { success: true };
});
exports.endGame = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    const { gameId, winner } = data;
    const gameSnapshot = await db.ref(`games/${gameId}`).once('value');
    const game = gameSnapshot.val();
    if (!game)
        throw new functions.https.HttpsError('not-found', 'Game not found');
    if (game.host_uid !== context.auth.uid) {
        throw new functions.https.HttpsError('permission-denied', 'Only host can end game');
    }
    await db.ref(`games/${gameId}`).update({
        status: 'ENDED',
        winner: winner || 'NONE'
    });
    return { success: true };
});
async function checkGameEnd(gameId) {
    const [gameSnapshot, playersSnapshot, assignmentsSnapshot] = await Promise.all([
        db.ref(`games/${gameId}`).once('value'),
        db.ref(`players/${gameId}`).once('value'),
        db.ref(`assignments/${gameId}`).once('value')
    ]);
    const game = gameSnapshot.val();
    const players = playersSnapshot.val() || {};
    const assignments = assignmentsSnapshot.val() || {};
    if (!game || game.status !== 'RUNNING')
        return;
    let aliveImpostors = 0;
    let aliveCrewmates = 0;
    let aliveSnitches = 0;
    for (const player of Object.values(players)) {
        if (player.alive) {
            if (player.role === 'IMPOSTOR')
                aliveImpostors++;
            else if (player.role === 'SNITCH')
                aliveSnitches++;
            else
                aliveCrewmates++;
        }
    }
    if (aliveImpostors >= aliveCrewmates + aliveSnitches) {
        await db.ref(`games/${gameId}`).update({
            status: 'ENDED',
            winner: 'IMPOSTORS'
        });
        return;
    }
    if (aliveImpostors === 0) {
        let allTasksComplete = true;
        for (const [playerId, playerAssignments] of Object.entries(assignments)) {
            const player = players[playerId];
            if (!player || player.role === 'IMPOSTOR')
                continue;
            for (const assignment of Object.values(playerAssignments)) {
                if (assignment.status !== 'COMPLETE') {
                    allTasksComplete = false;
                    break;
                }
            }
            if (!allTasksComplete)
                break;
        }
        if (allTasksComplete) {
            await db.ref(`games/${gameId}`).update({
                status: 'ENDED',
                winner: 'CREWMATES'
            });
        }
    }
}
exports.selectWhoDied = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    const { gameId, playerId } = data;
    const playerSnapshot = await db.ref(`players/${gameId}/${playerId}`).once('value');
    const player = playerSnapshot.val();
    if (!player)
        throw new functions.https.HttpsError('not-found', 'Player not found');
    if (!player.alive)
        throw new functions.https.HttpsError('failed-precondition', 'Player already dead');
    await db.ref(`players/${gameId}/${playerId}/alive`).set(false);
    await checkGameEnd(gameId);
    return { success: true };
});
exports.commenceVoting = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    const { gameId } = data;
    const gameSnapshot = await db.ref(`games/${gameId}`).once('value');
    const game = gameSnapshot.val();
    if (!game)
        throw new functions.https.HttpsError('not-found', 'Game not found');
    if (!game.interrupts.active || game.interrupts.active.type !== 'MEETING') {
        throw new functions.https.HttpsError('failed-precondition', 'No meeting active');
    }
    const now = Date.now();
    const votingEndsAt = now + game.config.voting_duration_ms;
    await db.ref(`meetings/${gameId}/${game.interrupts.active.id}/ends_at`).set(votingEndsAt);
    return { success: true };
});
//# sourceMappingURL=index.js.map