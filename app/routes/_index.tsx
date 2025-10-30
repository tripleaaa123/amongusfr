import { useState } from "react";
import { useNavigate } from "react-router";
import { signInAnon, callFunction } from "../lib/firebase";
import { callHttpFunction } from "../lib/firebase-http";
import type { Route } from "../+types/root";

export default function Index() {
  const [gameCode, setGameCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleCreateGame = async () => {
    setLoading(true);
    setError("");
    try {
      await signInAnon();
      const result = await callHttpFunction<{}, {gameId: string, gameCode: string, accessoryCode: string, playerId: string}>("createGameHTTP", {});

      // Store host player info
      localStorage.setItem("player_id", result.playerId);
      localStorage.setItem("game_id", result.gameId);

      navigate(`/host/create?gameId=${result.gameId}&code=${result.gameCode}&accessoryCode=${result.accessoryCode}`);
    } catch (err: any) {
      setError(err.message || "Failed to create game");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGame = async () => {
    if (!gameCode || !nickname) {
      setError("Please enter game code and nickname");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await signInAnon();
      const deviceId = localStorage.getItem("device_id") || crypto.randomUUID();
      localStorage.setItem("device_id", deviceId);

      const result = await callHttpFunction<
        {gameCode: string, nickname: string, deviceId: string},
        {playerId: string, rejoinToken: string, gameId: string}
      >("joinGameHTTP", {
        gameCode: gameCode.toUpperCase(),
        nickname,
        deviceId
      });

      localStorage.setItem("player_id", result.playerId);
      localStorage.setItem("rejoin_token", result.rejoinToken);
      navigate(`/game/${result.gameId}/lobby`);
    } catch (err: any) {
      setError(err.message || "Failed to join game");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-8">Among Us PWA</h1>

      <div className="w-full max-w-sm space-y-6">
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Join Game</h2>

          <input
            type="text"
            placeholder="Game Code"
            value={gameCode}
            onChange={(e) => setGameCode(e.target.value.toUpperCase())}
            className="w-full px-4 py-3 bg-gray-700 rounded-lg mb-3 text-center text-xl tracking-wider"
            maxLength={4}
            disabled={loading}
          />

          <input
            type="text"
            placeholder="Nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="w-full px-4 py-3 bg-gray-700 rounded-lg mb-4"
            maxLength={20}
            disabled={loading}
          />

          <button
            onClick={handleJoinGame}
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 py-3 rounded-lg font-semibold transition-colors"
          >
            {loading ? "Joining..." : "Join Game"}
          </button>
        </div>

        <div className="text-center">
          <div className="text-gray-500 mb-3">or</div>
          <button
            onClick={handleCreateGame}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 py-3 rounded-lg font-semibold transition-colors"
          >
            {loading ? "Creating..." : "Host New Game"}
          </button>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-600 rounded-lg p-3 text-center">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}