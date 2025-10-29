import { useState, useEffect } from "react";

interface MiniGameWiresProps {
  onComplete: (timeMs: number) => void;
  onCancel: () => void;
}

interface Wire {
  id: number;
  color: string;
  leftY: number;
  rightY: number;
}

export default function MiniGameWires({ onComplete, onCancel }: MiniGameWiresProps) {
  const [startTime] = useState(Date.now());
  const [wires] = useState<Wire[]>([
    { id: 1, color: '#EF4444', leftY: 20, rightY: 60 },
    { id: 2, color: '#10B981', leftY: 40, rightY: 20 },
    { id: 3, color: '#3B82F6', leftY: 60, rightY: 40 }
  ]);
  const [connections, setConnections] = useState<{ [key: number]: number }>({});
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);

  useEffect(() => {
    if (Object.keys(connections).length === wires.length) {
      const isCorrect = wires.every(w => connections[w.id] === w.id);
      if (isCorrect) {
        const timeMs = Date.now() - startTime;
        onComplete(timeMs);
      }
    }
  }, [connections, wires, startTime, onComplete]);

  const handleLeftClick = (wireId: number) => {
    setSelectedLeft(wireId);
  };

  const handleRightClick = (wireId: number) => {
    if (selectedLeft !== null) {
      setConnections(prev => ({ ...prev, [selectedLeft]: wireId }));
      setSelectedLeft(null);
    }
  };

  const resetConnections = () => {
    setConnections({});
    setSelectedLeft(null);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="text-white mb-4">
        <h3 className="text-lg font-bold">Connect the Wires</h3>
        <p className="text-sm text-gray-400">Match colors on both sides</p>
      </div>

      <div className="relative h-48 bg-gray-900 rounded-lg p-4">
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {Object.entries(connections).map(([leftId, rightId]) => {
            const leftWire = wires.find(w => w.id === parseInt(leftId));
            const rightWire = wires.find(w => w.id === rightId);
            if (!leftWire || !rightWire) return null;

            return (
              <line
                key={`${leftId}-${rightId}`}
                x1="20%"
                y1={`${leftWire.leftY}%`}
                x2="80%"
                y2={`${rightWire.rightY}%`}
                stroke={leftWire.color}
                strokeWidth="3"
                opacity="0.7"
              />
            );
          })}
        </svg>

        <div className="flex justify-between h-full">
          <div className="flex flex-col justify-around">
            {wires.map(wire => (
              <button
                key={`left-${wire.id}`}
                onClick={() => handleLeftClick(wire.id)}
                className={`w-12 h-12 rounded-full transition-all ${
                  selectedLeft === wire.id ? 'ring-4 ring-white scale-110' : ''
                }`}
                style={{ backgroundColor: wire.color }}
              />
            ))}
          </div>

          <div className="flex flex-col justify-around">
            {wires.map(wire => (
              <button
                key={`right-${wire.id}`}
                onClick={() => handleRightClick(wire.id)}
                className="w-12 h-12 rounded-full transition-all hover:scale-110"
                style={{ backgroundColor: wire.color }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={resetConnections}
          className="flex-1 bg-gray-600 text-white py-2 rounded"
        >
          Reset
        </button>
        <button
          onClick={onCancel}
          className="flex-1 bg-red-600 text-white py-2 rounded"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}