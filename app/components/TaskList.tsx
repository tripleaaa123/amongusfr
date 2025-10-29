import { useState } from "react";
import { Task, Assignment, callFunction, uploadProof } from "../lib/firebase";
import CameraScanner from "./CameraScanner";
import PhotoCapture from "./PhotoCapture";
import MiniGameReaction from "./MiniGameReaction";
import MiniGameWires from "./MiniGameWires";

interface TaskListProps {
  tasks: { [taskId: string]: Task };
  assignments: { [taskId: string]: Assignment };
  gameId: string;
  playerId: string;
  isGhost: boolean;
}

export default function TaskList({ tasks, assignments, gameId, playerId, isGhost }: TaskListProps) {
  const [activeTask, setActiveTask] = useState<string | null>(null);
  const [scanningQr, setScanningQr] = useState(false);
  const [takingPhoto, setTakingPhoto] = useState(false);
  const [playingMini, setPlayingMini] = useState<string | null>(null);

  const handleQrScan = async (qrToken: string) => {
    setScanningQr(false);
    try {
      const scan = callFunction("scanQrAndStartTask");
      const result = await scan({ gameId, qrToken });

      if (result.data.requiresPhoto) {
        setTakingPhoto(true);
      } else if (result.data.miniId) {
        setPlayingMini(result.data.miniId);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handlePhotoCapture = async (blob: Blob) => {
    setTakingPhoto(false);
    if (!activeTask) return;

    try {
      const proofUrl = await uploadProof(gameId, playerId, activeTask, blob);
      alert("Task completed!");
      setActiveTask(null);
    } catch (err: any) {
      alert("Failed to upload proof");
    }
  };

  const handleMiniComplete = async (score: number) => {
    setPlayingMini(null);
    if (!activeTask || !playingMini) return;

    try {
      const complete = callFunction("completeDigitalTask");
      await complete({ gameId, taskId: activeTask, miniId: playingMini, score });
      alert("Task completed!");
      setActiveTask(null);
    } catch (err: any) {
      alert("Failed to complete task");
    }
  };

  const sortedAssignments = Object.entries(assignments).sort(([, a], [, b]) => {
    if (a.status === b.status) return 0;
    return a.status === 'PENDING' ? -1 : 1;
  });

  if (scanningQr) {
    return <CameraScanner onScan={handleQrScan} onCancel={() => setScanningQr(false)} />;
  }

  if (takingPhoto) {
    return <PhotoCapture onCapture={handlePhotoCapture} onCancel={() => setTakingPhoto(false)} />;
  }

  if (playingMini === 'mg_reaction') {
    return <MiniGameReaction onComplete={handleMiniComplete} onCancel={() => setPlayingMini(null)} />;
  }

  if (playingMini === 'mg_wires') {
    return <MiniGameWires onComplete={handleMiniComplete} onCancel={() => setPlayingMini(null)} />;
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">
        Tasks ({Object.values(assignments).filter(a => a.status === 'COMPLETE').length}/{Object.keys(assignments).length})
      </h2>

      <div className="space-y-2">
        {sortedAssignments.map(([taskId, assignment]) => {
          const task = tasks[taskId];
          if (!task) return null;

          const isComplete = assignment.status === 'COMPLETE';

          return (
            <div
              key={taskId}
              className={`bg-gray-800 rounded-lg p-4 ${isComplete ? 'opacity-50' : ''}`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <div className={`font-medium ${isComplete ? 'line-through' : ''}`}>
                    {task.label}
                  </div>
                  <div className="text-sm text-gray-400">
                    {task.type === 'PHYSICAL' ? `📍 ${task.location || 'Unknown'}` : '💻 Digital'}
                    {isGhost && !isComplete && task.type === 'PHYSICAL' && ' (Now Digital)'}
                  </div>
                </div>

                {!isComplete && (
                  <button
                    onClick={() => {
                      setActiveTask(taskId);
                      if (isGhost || task.type === 'DIGITAL') {
                        setPlayingMini(task.mini_id || 'mg_reaction');
                      } else {
                        setScanningQr(true);
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
                  >
                    Start
                  </button>
                )}

                {isComplete && (
                  <div className="text-green-500">✓</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}