import { useState } from "react";
import { Player } from "../lib/firebase";

interface ActionsSheetProps {
  player: Player;
  allPlayers: Player[];
  onCallMeeting: () => void;
  onSabotage: () => void;
  onKill: (victimId: string) => void;
}

export default function ActionsSheet({ player, allPlayers, onCallMeeting, onSabotage, onKill }: ActionsSheetProps) {
  const [selectingKillTarget, setSelectingKillTarget] = useState(false);

  const alivePlayers = allPlayers.filter(p => p.alive && p.id !== player.uid);
  const canCallMeeting = player.alive && (!player.cooldowns?.meeting_ready_at || player.cooldowns.meeting_ready_at <= Date.now());
  const canSabotage = player.alive && player.role === 'IMPOSTOR' && (!player.cooldowns?.sabotage_ready_at || player.cooldowns.sabotage_ready_at <= Date.now());
  const canKill = player.alive && player.role === 'IMPOSTOR';

  if (selectingKillTarget) {
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">Select Player to Eliminate</h2>
        <div className="space-y-2">
          {alivePlayers.map(p => (
            <button
              key={p.id}
              onClick={() => {
                if (confirm(`Mark ${p.nickname} as dead?`)) {
                  onKill(p.id!);
                  setSelectingKillTarget(false);
                }
              }}
              className="w-full bg-gray-800 hover:bg-gray-700 p-4 rounded-lg text-left"
            >
              {p.nickname}
            </button>
          ))}
        </div>
        <button
          onClick={() => setSelectingKillTarget(false)}
          className="w-full mt-4 bg-gray-700 hover:bg-gray-600 p-4 rounded-lg"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Actions</h2>
      <div className="space-y-4">
        {(player.role === 'CREWMATE' || player.role === 'SNITCH') && (
          <button
            onClick={onCallMeeting}
            disabled={!canCallMeeting}
            className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-700 p-6 rounded-lg text-xl font-semibold"
          >
            Call Meeting
            {player.cooldowns?.meeting_ready_at && player.cooldowns.meeting_ready_at > Date.now() && (
              <div className="text-sm mt-1">
                Ready in {Math.ceil((player.cooldowns.meeting_ready_at - Date.now()) / 1000)}s
              </div>
            )}
          </button>
        )}

        {player.role === 'IMPOSTOR' && (
          <>
            <button
              onClick={onSabotage}
              disabled={!canSabotage}
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-700 p-6 rounded-lg text-xl font-semibold"
            >
              Sabotage
              {player.cooldowns?.sabotage_ready_at && player.cooldowns.sabotage_ready_at > Date.now() && (
                <div className="text-sm mt-1">
                  Ready in {Math.ceil((player.cooldowns.sabotage_ready_at - Date.now()) / 1000)}s
                </div>
              )}
            </button>

            <button
              onClick={() => setSelectingKillTarget(true)}
              disabled={!canKill}
              className="w-full bg-red-800 hover:bg-red-900 disabled:bg-gray-700 p-6 rounded-lg text-xl font-semibold"
            >
              Mark as Dead
            </button>
          </>
        )}

        {!player.alive && (
          <div className="text-center text-gray-500 py-8">
            You cannot perform actions while dead
          </div>
        )}
      </div>
    </div>
  );
}