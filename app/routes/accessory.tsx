import { useState } from "react";
import { useNavigate } from "react-router";
import { signInAnon } from "../lib/firebase";
import { callHttpFunction } from "../lib/firebase-http";

export default function AccessoryJoin() {
  const [accessoryCode, setAccessoryCode] = useState("");
  const [role, setRole] = useState<'MASTER' | 'SLAVE'>('MASTER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleJoin = async () => {
    if (!accessoryCode) {
      setError("Please enter an accessory code");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await signInAnon();
      const result = await callHttpFunction<
        {accessoryCode: string, role: string},
        {accessoryId: string, gameId: string}
      >("joinAccessoryHTTP", {
        accessoryCode: accessoryCode.toUpperCase(),
        role
      });

      // Store accessory info
      localStorage.setItem("accessory_id", result.accessoryId);
      localStorage.setItem("accessory_role", role);

      // Navigate to the game accessory page
      navigate(`/game/${result.gameId}/accessory`);
    } catch (err: any) {
      setError(err.message || "Failed to join as accessory");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-8">Join as Accessory Device</h1>

      <div className="w-full max-w-sm space-y-6">
        <div className="bg-gray-800 rounded-lg p-6">
          <input
            type="text"
            placeholder="Accessory Code"
            value={accessoryCode}
            onChange={(e) => setAccessoryCode(e.target.value.toUpperCase())}
            className="w-full px-4 py-3 bg-gray-700 rounded-lg mb-4 text-center text-xl tracking-wider"
            maxLength={4}
            disabled={loading}
          />

          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">Select Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'MASTER' | 'SLAVE')}
              className="w-full px-4 py-3 bg-gray-700 rounded-lg"
              disabled={loading}
            >
              <option value="MASTER">Master (Controls)</option>
              <option value="SLAVE">Slave (Display)</option>
            </select>
          </div>

          <button
            onClick={handleJoin}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 py-3 rounded-lg font-semibold transition-colors"
          >
            {loading ? "Joining..." : "Join as Accessory"}
          </button>

          {error && (
            <div className="mt-4 bg-red-900/50 border border-red-600 rounded-lg p-3 text-center">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}