import { useState, useEffect } from "react";
import { useParams } from "react-router";
import { db, Game, Player, callFunction } from "../lib/firebase";
import { ref, onValue } from "firebase/database";
import MiniGameWires from "../components/MiniGameWires";
import Countdown from "../components/Countdown";

export default function AccessoryDevice() {
  const { gameId } = useParams();
  const [role, setRole] = useState<'MASTER' | 'SLAVE' | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  useEffect(() => {
    if (!gameId || !role) return;

    const gameRef = ref(db, `games/${gameId}`);
    const playersRef = ref(db, `players/${gameId}`);

    const unsubGame = onValue(gameRef, (snapshot) => {
      setGame(snapshot.val());
    });

    const unsubPlayers = onValue(playersRef, (snapshot) => {
      const data = snapshot.val() || {};
      setPlayers(Object.entries(data).map(([id, player]: any) => ({ ...player, id })));
    });

    return () => {
      unsubGame();
      unsubPlayers();
    };
  }, [gameId, role]);

  const handleJoinAsRole = async (selectedRole: 'MASTER' | 'SLAVE') => {
    const accessoryCode = prompt("Enter Accessory Code:");
    if (!accessoryCode) return;

    try {
      const join = callFunction("joinAccessory");
      await join({ accessoryCode: accessoryCode.toUpperCase(), role: selectedRole });
      setRole(selectedRole);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSelectWhoDied = async () => {
    if (!selectedPlayer) {
      alert("Select a player first");
      return;
    }

    try {
      const select = callFunction("selectWhoDied");
      await select({ gameId, playerId: selectedPlayer });
      setSelectedPlayer(null);
      alert("Player marked as dead");
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCommenceVoting = async () => {
    try {
      const commence = callFunction("commenceVoting");
      await commence({ gameId });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleResolveMeeting = async () => {
    if (!game?.interrupts.active) return;

    try {
      const resolve = callFunction("resolveMeeting");
      await resolve({ gameId, meetingId: game.interrupts.active.id });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSabotageMiniComplete = async (score: number) => {
    if (!game?.interrupts.active) return;

    try {
      const complete = callFunction("completeSabotageMini");
      await complete({
        gameId,
        interruptId: game.interrupts.active.id,
        accessoryRole: role
      });
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (!role) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
        <h1 className="text-3xl font-bold mb-8">Accessory Device</h1>
        <div className="space-y-4 w-full max-w-sm">
          <button
            onClick={() => handleJoinAsRole('MASTER')}
            className="w-full bg-purple-600 hover:bg-purple-700 py-4 rounded-lg text-xl font-semibold"
          >
            Join as MASTER
          </button>
          <button
            onClick={() => handleJoinAsRole('SLAVE')}
            className="w-full bg-orange-600 hover:bg-orange-700 py-4 rounded-lg text-xl font-semibold"
          >
            Join as SLAVE
          </button>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  const alivePlayers = players.filter(p => p.alive);

  if (game.interrupts.active?.type === 'SABOTAGE') {
    return (
      <div className="min-h-screen bg-red-900 text-white p-4">
        <div className="text-center mb-4">
          <h1 className="text-3xl font-bold">SABOTAGE ACTIVE</h1>
          <div className="mt-2">Role: {role}</div>
          <Countdown endsAt={game.interrupts.active.ends_at} />
        </div>

        {role === 'MASTER' && (
          <div className="text-center mb-4">
            <div className="text-xl">🔊 ALARM PLAYING 🔊</div>
          </div>
        )}

        <div className="max-w-md mx-auto">
          <MiniGameWires
            onComplete={handleSabotageMiniComplete}
            onCancel={() => {}}
          />
        </div>
      </div>
    );
  }

  if (game.interrupts.active?.type === 'MEETING') {
    return (
      <div className="min-h-screen bg-yellow-900 text-white p-4">
        <div className="text-center mb-4">
          <h1 className="text-3xl font-bold">MEETING IN PROGRESS</h1>
          <div className="mt-2">Role: {role}</div>
          <Countdown endsAt={game.interrupts.active.ends_at} />
        </div>

        {role === 'MASTER' && (
          <div className="space-y-4 max-w-md mx-auto">
            <button
              onClick={handleCommenceVoting}
              className="w-full bg-green-600 hover:bg-green-700 py-4 rounded-lg text-xl font-semibold"
            >
              Commence Voting
            </button>
            <button
              onClick={handleResolveMeeting}
              className="w-full bg-blue-600 hover:bg-blue-700 py-4 rounded-lg text-xl font-semibold"
            >
              Resolve Meeting
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold">Accessory: {role}</h1>
        <div className="text-gray-400">Game: {game.code}</div>
      </div>

      {role === 'MASTER' && (
        <div className="max-w-md mx-auto space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-4">Select Who Died</h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {alivePlayers.map(player => (
                <button
                  key={player.id}
                  onClick={() => setSelectedPlayer(player.id!)}
                  className={`w-full p-3 rounded-lg text-left ${
                    selectedPlayer === player.id ? 'bg-red-600' : 'bg-gray-800 hover:bg-gray-700'
                  }`}
                >
                  {player.nickname}
                </button>
              ))}
            </div>
            <button
              onClick={handleSelectWhoDied}
              disabled={!selectedPlayer}
              className="w-full mt-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 py-3 rounded-lg font-semibold"
            >
              Confirm Death
            </button>
          </div>

          <button
            onClick={handleCommenceVoting}
            className="w-full bg-yellow-600 hover:bg-yellow-700 py-4 rounded-lg text-xl font-semibold"
          >
            Commence Voting
          </button>
        </div>
      )}

      {role === 'SLAVE' && (
        <div className="text-center text-gray-500">
          <p className="text-xl">Waiting for sabotage...</p>
          <p className="mt-2">You'll need to complete mini-game during sabotage</p>
        </div>
      )}
    </div>
  );
}