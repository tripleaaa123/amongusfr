import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { db, Game, Player } from "../lib/firebase";
import { ref, onValue } from "firebase/database";

export default function GameLobby() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayerId] = useState(() => localStorage.getItem("player_id"));

  useEffect(() => {
    if (!gameId) return;

    const gameRef = ref(db, `games/${gameId}`);
    const playersRef = ref(db, `players/${gameId}`);

    const unsubGame = onValue(gameRef, (snapshot) => {
      const data = snapshot.val();
      setGame(data);

      if (data?.status === 'RUNNING') {
        navigate(`/game/${gameId}/play`);
      }
    });

    const unsubPlayers = onValue(playersRef, (snapshot) => {
      const data = snapshot.val() || {};
      console.log('Players data from Firebase:', data);
      setPlayers(Object.entries(data).map(([id, player]: any) => ({ id, ...player })));
    });

    return () => {
      unsubGame();
      unsubPlayers();
    };
  }, [gameId, navigate]);

  const currentPlayer = players.find(p => p.id === currentPlayerId);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-md mx-auto">
        <div className="bg-gray-800 rounded-lg p-6 mb-4">
          <h1 className="text-2xl font-bold mb-2">Game Lobby</h1>
          <div className="text-3xl font-mono font-bold text-center py-4">
            {game?.code}
          </div>
          {currentPlayer && (
            <div className="text-center text-gray-400">
              Playing as: {currentPlayer.nickname}
            </div>
          )}
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Players ({players.length})</h2>
          <div className="space-y-2">
            {players.map(player => (
              <div
                key={player.id}
                className={`bg-gray-700 rounded px-3 py-2 ${player.id === currentPlayerId ? 'ring-2 ring-blue-500' : ''}`}
              >
                {player.nickname}
              </div>
            ))}
          </div>

          {game?.status === 'LOBBY' && (
            <div className="mt-6 text-center text-gray-500">
              Waiting for host to start the game...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}