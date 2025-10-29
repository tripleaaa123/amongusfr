import { useEffect, useState } from "react";
import { Game, Player, InterruptType, callFunction } from "../lib/firebase";
import { ref, onValue } from "firebase/database";
import { db } from "../lib/firebase";
import Countdown from "./Countdown";
import VotingPanel from "./VotingPanel";
import MiniGameWires from "./MiniGameWires";

interface GlobalOverlayProps {
  gameId: string;
  interrupt: {
    id: string;
    type: InterruptType;
    started_at: number;
    ends_at: number;
  };
  game: Game;
  player: Player;
  allPlayers: Player[];
}

export default function GlobalOverlay({ gameId, interrupt, game, player, allPlayers }: GlobalOverlayProps) {
  const [meeting, setMeeting] = useState<any>(null);
  const [sabotageComplete, setSabotageComplete] = useState(false);

  useEffect(() => {
    if (interrupt.type !== 'MEETING') return;

    const meetingRef = ref(db, `meetings/${gameId}/${interrupt.id}`);
    const unsub = onValue(meetingRef, (snapshot) => {
      setMeeting(snapshot.val());
    });

    return () => unsub();
  }, [gameId, interrupt]);

  const handleSabotageMiniComplete = async (score: number) => {
    if (score > 20000) {
      alert("Failed! Try again.");
      return;
    }

    try {
      const complete = callFunction("completeSabotageMini");
      await complete({
        gameId,
        interruptId: interrupt.id,
        accessoryRole: 'MASTER'
      });
      setSabotageComplete(true);
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (interrupt.type === 'SABOTAGE') {
    return (
      <div className="fixed inset-0 bg-red-900 z-50 flex flex-col items-center justify-center p-4">
        <div className="text-white text-center">
          <div className="text-4xl font-bold mb-4">SABOTAGE!</div>
          <Countdown endsAt={interrupt.ends_at} />

          {!sabotageComplete && (
            <div className="mt-8 w-full max-w-md">
              <div className="text-lg mb-4">Complete the task to fix!</div>
              <MiniGameWires
                onComplete={handleSabotageMiniComplete}
                onCancel={() => {}}
              />
            </div>
          )}

          {sabotageComplete && (
            <div className="mt-8 text-2xl text-green-400">
              ✓ Sabotage Fixed!
            </div>
          )}
        </div>
      </div>
    );
  }

  if (interrupt.type === 'MEETING') {
    return (
      <div className="fixed inset-0 bg-yellow-900 z-50 flex flex-col p-4">
        <div className="text-white text-center mb-4">
          <div className="text-3xl font-bold">EMERGENCY MEETING</div>
          <Countdown endsAt={interrupt.ends_at} />
        </div>

        <div className="flex-1 overflow-y-auto">
          {meeting && (
            <VotingPanel
              meeting={meeting}
              player={player}
              allPlayers={allPlayers}
              gameId={gameId}
            />
          )}
        </div>
      </div>
    );
  }

  return null;
}