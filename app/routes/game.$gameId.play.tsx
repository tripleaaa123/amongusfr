import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { db, Game, Player, Task, Assignment, callFunction } from "../lib/firebase";
import { ref, onValue } from "firebase/database";
import TaskList from "../components/TaskList";
import RoleCard from "../components/RoleCard";
import ActionsSheet from "../components/ActionsSheet";
import GlobalOverlay from "../components/GlobalOverlay";

export default function GamePlay() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'tasks' | 'role' | 'actions'>('tasks');
  const [game, setGame] = useState<Game | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [tasks, setTasks] = useState<{ [taskId: string]: Task }>({});
  const [assignments, setAssignments] = useState<{ [taskId: string]: Assignment }>({});
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);

  const playerId = localStorage.getItem("player_id") || "";

  useEffect(() => {
    if (!gameId || !playerId) return;

    const gameRef = ref(db, `games/${gameId}`);
    const playerRef = ref(db, `players/${gameId}/${playerId}`);
    const tasksRef = ref(db, `tasks/${gameId}`);
    const assignmentsRef = ref(db, `assignments/${gameId}/${playerId}`);
    const allPlayersRef = ref(db, `players/${gameId}`);

    const unsubGame = onValue(gameRef, (snapshot) => {
      const data = snapshot.val();
      setGame(data);

      if (data?.status === 'ENDED') {
        navigate(`/game/${gameId}/end`);
      }
    });

    const unsubPlayer = onValue(playerRef, (snapshot) => {
      setPlayer(snapshot.val());
    });

    const unsubTasks = onValue(tasksRef, (snapshot) => {
      setTasks(snapshot.val() || {});
    });

    const unsubAssignments = onValue(assignmentsRef, (snapshot) => {
      setAssignments(snapshot.val() || {});
    });

    const unsubAllPlayers = onValue(allPlayersRef, (snapshot) => {
      const data = snapshot.val() || {};
      setAllPlayers(Object.entries(data).map(([id, p]: any) => ({ ...p, id })));
    });

    return () => {
      unsubGame();
      unsubPlayer();
      unsubTasks();
      unsubAssignments();
      unsubAllPlayers();
    };
  }, [gameId, playerId, navigate]);

  const handleCallMeeting = async () => {
    try {
      const call = callFunction("playerCallMeeting");
      await call({ gameId });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSabotage = async () => {
    try {
      const sabotage = callFunction("impostorSabotage");
      await sabotage({ gameId });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleKill = async (victimId: string) => {
    try {
      const kill = callFunction("impostorMarkDead");
      await kill({ gameId, victimPlayerId: victimId });
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (!game || !player) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  const completedTasks = Object.values(assignments).filter(a => a.status === 'COMPLETE').length;
  const totalTasks = Object.keys(assignments).length;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {game.interrupts.active && (
        <GlobalOverlay
          gameId={gameId!}
          interrupt={game.interrupts.active}
          game={game}
          player={player}
          allPlayers={allPlayers}
        />
      )}

      <div className="flex-1 overflow-y-auto pb-20">
        {!player.alive && (
          <div className="bg-red-900 text-center py-3 px-4">
            <div className="text-lg font-bold">YOU ARE DEAD</div>
            {player.role === 'IMPOSTOR' ? (
              <div className="text-sm">Go to camera room</div>
            ) : (
              <div className="text-sm">Complete ghost tasks ({completedTasks}/{totalTasks})</div>
            )}
          </div>
        )}

        <div className="p-4">
          {activeTab === 'tasks' && (
            <TaskList
              tasks={tasks}
              assignments={assignments}
              gameId={gameId!}
              playerId={playerId}
              isGhost={!player.alive}
            />
          )}

          {activeTab === 'role' && (
            <RoleCard player={player} />
          )}

          {activeTab === 'actions' && (
            <ActionsSheet
              player={player}
              allPlayers={allPlayers}
              onCallMeeting={handleCallMeeting}
              onSabotage={handleSabotage}
              onKill={handleKill}
            />
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700">
        <div className="flex">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex-1 py-4 ${activeTab === 'tasks' ? 'bg-gray-700' : ''}`}
          >
            Tasks ({completedTasks}/{totalTasks})
          </button>
          <button
            onClick={() => setActiveTab('role')}
            className={`flex-1 py-4 ${activeTab === 'role' ? 'bg-gray-700' : ''}`}
          >
            Role
          </button>
          <button
            onClick={() => setActiveTab('actions')}
            className={`flex-1 py-4 ${activeTab === 'actions' ? 'bg-gray-700' : ''}`}
          >
            Actions
          </button>
        </div>
      </div>
    </div>
  );
}