import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { db, callFunction, GameConfig } from "../lib/firebase";
import { callHttpFunction } from "../lib/firebase-http";
import { ref, onValue, update } from "firebase/database";

export default function HostCreate() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const gameId = searchParams.get("gameId") || "";
  const gameCode = searchParams.get("code") || "";
  const accessoryCode = searchParams.get("accessoryCode") || "";

  const [config, setConfig] = useState<GameConfig>({
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
  });

  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!gameId) return;

    const playersRef = ref(db, `players/${gameId}`);
    const unsubscribe = onValue(playersRef, (snapshot) => {
      const data = snapshot.val() || {};
      setPlayers(Object.entries(data).map(([id, player]: any) => ({ id, ...player })));
    });

    return () => unsubscribe();
  }, [gameId]);

  const updateConfig = (key: keyof GameConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const saveConfig = async () => {
    try {
      const configRef = ref(db, `games/${gameId}/config`);
      await update(configRef, config);
    } catch (err) {
      console.error("Failed to save config:", err);
    }
  };

  const startGame = async () => {
    setLoading(true);
    try {
      await saveConfig();
      const result = await callHttpFunction<{gameId: string}, {success: boolean}>("startGameHTTP", { gameId });
      navigate(`/game/${gameId}/play`);
    } catch (err: any) {
      alert(err.message || "Failed to start game");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-800 rounded-lg p-6 mb-4">
          <h1 className="text-2xl font-bold mb-4">Host Game</h1>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-400">Game Code</div>
              <div className="text-3xl font-mono font-bold">{gameCode}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400">Accessory Code</div>
              <div className="text-3xl font-mono font-bold">{accessoryCode}</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 mb-4">
          <h2 className="text-xl font-semibold mb-4">Players ({players.length})</h2>
          <div className="space-y-2">
            {players.map(player => (
              <div key={player.id} className="bg-gray-700 rounded px-3 py-2">
                {player.nickname}
              </div>
            ))}
            {players.length === 0 && (
              <div className="text-gray-500">Waiting for players to join...</div>
            )}
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 mb-4">
          <h2 className="text-xl font-semibold mb-4">Game Configuration</h2>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Impostors</label>
                <input
                  type="number"
                  value={config.impostors}
                  onChange={(e) => updateConfig('impostors', parseInt(e.target.value))}
                  min="1"
                  max="3"
                  className="w-full px-3 py-2 bg-gray-700 rounded"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Snitches</label>
                <input
                  type="number"
                  value={config.snitches}
                  onChange={(e) => updateConfig('snitches', parseInt(e.target.value))}
                  min="0"
                  max="2"
                  className="w-full px-3 py-2 bg-gray-700 rounded"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Tasks Per Player</label>
                <input
                  type="number"
                  value={config.tasks_per_player}
                  onChange={(e) => updateConfig('tasks_per_player', parseInt(e.target.value))}
                  min="1"
                  max="10"
                  className="w-full px-3 py-2 bg-gray-700 rounded"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Task Pool Size</label>
                <input
                  type="number"
                  value={config.task_pool_size}
                  onChange={(e) => updateConfig('task_pool_size', parseInt(e.target.value))}
                  min="5"
                  max="20"
                  className="w-full px-3 py-2 bg-gray-700 rounded"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Physical Task Ratio (%)</label>
              <input
                type="range"
                value={config.phys_dig_ratio.physical}
                onChange={(e) => {
                  const physical = parseInt(e.target.value);
                  updateConfig('phys_dig_ratio', { physical, digital: 100 - physical });
                }}
                min="0"
                max="100"
                className="w-full"
              />
              <div className="flex justify-between text-sm text-gray-500">
                <span>Physical: {config.phys_dig_ratio.physical}%</span>
                <span>Digital: {config.phys_dig_ratio.digital}%</span>
              </div>
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.ghost_tasks_enabled}
                  onChange={(e) => updateConfig('ghost_tasks_enabled', e.target.checked)}
                  className="mr-2"
                />
                <span>Enable Ghost Tasks</span>
              </label>
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.voting.allow_abstain}
                  onChange={(e) => updateConfig('voting', { ...config.voting, allow_abstain: e.target.checked })}
                  className="mr-2"
                />
                <span>Allow Vote Abstain</span>
              </label>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Tie Policy</label>
              <select
                value={config.voting.tie_policy}
                onChange={(e) => updateConfig('voting', { ...config.voting, tie_policy: e.target.value as 'NO_EJECT' | 'RANDOM_TOP' })}
                className="w-full px-3 py-2 bg-gray-700 rounded"
              >
                <option value="NO_EJECT">No Ejection</option>
                <option value="RANDOM_TOP">Random from Top</option>
              </select>
            </div>
          </div>
        </div>

        <button
          onClick={startGame}
          disabled={loading || players.length < 3}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 py-4 rounded-lg font-semibold transition-colors text-lg"
        >
          {loading ? "Starting..." : players.length < 3 ? `Need ${3 - players.length} more players` : "Start Game"}
        </button>
      </div>
    </div>
  );
}