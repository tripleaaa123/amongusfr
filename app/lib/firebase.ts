import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getDatabase, ref, onValue, set, push, serverTimestamp } from 'firebase/database';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'us-central1');

export const signInAnon = () => signInAnonymously(auth);

export const callFunction = <T = any, R = any>(name: string) =>
  httpsCallable<T, R>(functions, name);

export const uploadProof = async (gameId: string, playerId: string, taskId: string, file: Blob) => {
  const uuid = crypto.randomUUID();
  const path = `proofs/${gameId}/${playerId}/${taskId}/${uuid}.jpg`;
  const storageReference = storageRef(storage, path);
  const snapshot = await uploadBytes(storageReference, file);
  return getDownloadURL(snapshot.ref);
};

export type GameStatus = 'LOBBY' | 'RUNNING' | 'ENDED';
export type PlayerRole = 'CREWMATE' | 'IMPOSTOR' | 'SNITCH';
export type AccessoryRole = 'MASTER' | 'SLAVE';
export type TaskType = 'PHYSICAL' | 'DIGITAL';
export type TaskStatus = 'PENDING' | 'COMPLETE';
export type InterruptType = 'SABOTAGE' | 'MEETING';
export type Winner = 'IMPOSTORS' | 'CREWMATES' | 'SNITCH' | 'NONE';

export interface GameConfig {
  impostors: number;
  snitches: number;
  sabotage_duration_ms: number;
  meeting_duration_ms: number;
  voting_duration_ms: number;
  sabotage_cd_ms: number;
  meeting_cd_ms: number;
  task_pool_size: number;
  tasks_per_player: number;
  allow_task_dupes: boolean;
  phys_dig_ratio: { physical: number; digital: number };
  ghost_tasks_enabled: boolean;
  voting: { allow_abstain: boolean; tie_policy: 'NO_EJECT' | 'RANDOM_TOP' };
  audio: { hard_cap_ms: number };
}

export interface Game {
  status: GameStatus;
  host_uid: string;
  code: string;
  accessory_code: string;
  created_at: number;
  config: GameConfig;
  interrupts: {
    active: null | {
      id: string;
      type: InterruptType;
      started_at: number;
      ends_at: number;
    };
  };
  winner: null | Winner;
  timers: { server_ts: number };
}

export interface Player {
  uid: string;
  nickname: string;
  role: PlayerRole;
  alive: boolean;
  device_id: string;
  rejoin_token: string;
  joined_at: number;
  last_seen: number;
  cooldowns: {
    sabotage_ready_at?: number;
    meeting_ready_at?: number;
  };
}

export interface Accessory {
  role: AccessoryRole;
  connected: boolean;
  last_seen: number;
}

export interface Task {
  label: string;
  type: TaskType;
  qr_id?: string;
  mini_id?: string;
  location?: string;
}

export interface Assignment {
  status: TaskStatus;
  proof_url?: string;
  score?: number;
  completed_at?: number;
}

export interface Meeting {
  status: 'OPEN' | 'RESOLVED';
  started_at: number;
  ends_at: number;
  votes: {
    [voterPlayerId: string]: {
      target: string | null;
      ts: number;
    };
  };
  result?: {
    ejected_player_id?: string;
    reason: 'TIE_NO_EJECT' | 'MAJORITY' | 'RANDOM_TOP';
  };
}