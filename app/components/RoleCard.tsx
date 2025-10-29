import { Player } from "../lib/firebase";

interface RoleCardProps {
  player: Player;
}

export default function RoleCard({ player }: RoleCardProps) {
  const roleColors = {
    IMPOSTOR: 'bg-red-900',
    CREWMATE: 'bg-green-900',
    SNITCH: 'bg-yellow-900'
  };

  const roleDescriptions = {
    IMPOSTOR: 'Eliminate crewmates and sabotage their tasks',
    CREWMATE: 'Complete all tasks or find the impostors',
    SNITCH: 'Complete all tasks to reveal impostors'
  };

  return (
    <div className={`${roleColors[player.role]} rounded-lg p-6`}>
      <h2 className="text-3xl font-bold mb-2">{player.role}</h2>
      <p className="text-lg mb-4">{roleDescriptions[player.role]}</p>

      <div className="space-y-2">
        <div className="bg-black/20 rounded p-3">
          <div className="text-sm text-gray-300">Status</div>
          <div className="text-xl">{player.alive ? 'ALIVE' : 'DEAD'}</div>
        </div>

        <div className="bg-black/20 rounded p-3">
          <div className="text-sm text-gray-300">Nickname</div>
          <div className="text-xl">{player.nickname}</div>
        </div>

        {player.role === 'IMPOSTOR' && player.cooldowns?.sabotage_ready_at && (
          <div className="bg-black/20 rounded p-3">
            <div className="text-sm text-gray-300">Sabotage Cooldown</div>
            <div className="text-xl">
              {Math.max(0, Math.floor((player.cooldowns.sabotage_ready_at - Date.now()) / 1000))}s
            </div>
          </div>
        )}

        {player.cooldowns?.meeting_ready_at && (
          <div className="bg-black/20 rounded p-3">
            <div className="text-sm text-gray-300">Meeting Cooldown</div>
            <div className="text-xl">
              {Math.max(0, Math.floor((player.cooldowns.meeting_ready_at - Date.now()) / 1000))}s
            </div>
          </div>
        )}
      </div>
    </div>
  );
}