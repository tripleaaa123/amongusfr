import { useState, useEffect } from "react";

interface MiniGameReactionProps {
  onComplete: (avgTime: number) => void;
  onCancel: () => void;
}

export default function MiniGameReaction({ onComplete, onCancel }: MiniGameReactionProps) {
  const [round, setRound] = useState(0);
  const [showTarget, setShowTarget] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [times, setTimes] = useState<number[]>([]);
  const [waitingForNext, setWaitingForNext] = useState(false);

  useEffect(() => {
    if (round < 5 && !waitingForNext) {
      const delay = 1000 + Math.random() * 3000;
      const timeout = setTimeout(() => {
        setShowTarget(true);
        setStartTime(Date.now());
      }, delay);

      return () => clearTimeout(timeout);
    } else if (round === 5) {
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      onComplete(avgTime);
    }
  }, [round, times, waitingForNext, onComplete]);

  const handleTap = () => {
    if (!showTarget) return;

    const reactionTime = Date.now() - startTime;
    setTimes([...times, reactionTime]);
    setShowTarget(false);
    setWaitingForNext(true);

    setTimeout(() => {
      setRound(round + 1);
      setWaitingForNext(false);
    }, 500);
  };

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
      <div className="p-4 bg-gray-800">
        <h2 className="text-xl font-bold text-white">Reaction Test</h2>
        <p className="text-gray-400">Tap when the circle appears!</p>
        <p className="text-white mt-2">Round {round + 1} of 5</p>
      </div>

      <div
        className="flex-1 flex items-center justify-center"
        onClick={handleTap}
      >
        {showTarget && (
          <div className="w-32 h-32 bg-green-500 rounded-full animate-pulse" />
        )}

        {!showTarget && !waitingForNext && round < 5 && (
          <div className="text-white text-center">
            <div className="text-2xl">Get Ready...</div>
          </div>
        )}

        {waitingForNext && (
          <div className="text-white text-center">
            <div className="text-2xl">Good!</div>
            <div className="text-lg">{times[times.length - 1]}ms</div>
          </div>
        )}
      </div>

      <button
        onClick={onCancel}
        className="bg-red-600 text-white py-4 text-lg font-semibold"
      >
        Cancel
      </button>
    </div>
  );
}