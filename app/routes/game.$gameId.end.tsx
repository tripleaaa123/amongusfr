import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { db, Game, Player } from "../lib/firebase";
import { ref, onValue } from "firebase/database";

export default function GameEnd() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    if (!gameId) return;

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
  }, [gameId]);

  const handleBackToLobby = () => {
    navigate('/');
  };

  if (!game) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  const winnerColors = {
    IMPOSTORS: 'bg-red-900',
    CREWMATES: 'bg-green-900',
    SNITCH: 'bg-yellow-900',
    NONE: 'bg-gray-800'
  };

  const winnerText = {
    IMPOSTORS: 'Impostors Win!',
    CREWMATES: 'Crewmates Win!',
    SNITCH: 'Snitch Wins!',
    NONE: 'No Winner'
  };

  const impostors = players.filter(p => p.role === 'IMPOSTOR');
  const crewmates = players.filter(p => p.role === 'CREWMATE');
  const snitches = players.filter(p => p.role === 'SNITCH');

  return (
    <div className={`min-h-screen ${winnerColors[game.winner || 'NONE']} text-white p-4`}>
      <div className="max-w-2xl mx-auto">
        <div className="text-center py-8">
          <h1 className="text-5xl font-bold mb-4">
            {winnerText[game.winner || 'NONE']}
          </h1>
        </div>

        <div className="space-y-4">
          {impostors.length > 0 && (
            <div className="bg-black/20 rounded-lg p-4">
              <h2 className="text-xl font-semibold mb-2 text-red-400">Impostors</h2>
              <div className="space-y-2">
                {impostors.map(player => (
                  <div key={player.id} className="flex justify-between">
                    <span>{player.nickname}</span>
                    <span className={player.alive ? 'text-green-400' : 'text-red-400'}>
                      {player.alive ? 'Survived' : 'Eliminated'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {crewmates.length > 0 && (
            <div className="bg-black/20 rounded-lg p-4">
              <h2 className="text-xl font-semibold mb-2 text-green-400">Crewmates</h2>
              <div className="space-y-2">
                {crewmates.map(player => (
                  <div key={player.id} className="flex justify-between">
                    <span>{player.nickname}</span>
                    <span className={player.alive ? 'text-green-400' : 'text-red-400'}>
                      {player.alive ? 'Survived' : 'Eliminated'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {snitches.length > 0 && (
            <div className="bg-black/20 rounded-lg p-4">
              <h2 className="text-xl font-semibold mb-2 text-yellow-400">Snitches</h2>
              <div className="space-y-2">
                {snitches.map(player => (
                  <div key={player.id} className="flex justify-between">
                    <span>{player.nickname}</span>
                    <span className={player.alive ? 'text-green-400' : 'text-red-400'}>
                      {player.alive ? 'Survived' : 'Eliminated'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleBackToLobby}
          className="w-full mt-8 bg-blue-600 hover:bg-blue-700 py-4 rounded-lg font-semibold text-lg"
        >
          Back to Lobby
        </button>
      </div>
    </div>
  );
}