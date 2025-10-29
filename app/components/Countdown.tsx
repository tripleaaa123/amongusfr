import { useEffect, useState } from "react";

interface CountdownProps {
  endsAt: number;
}

export default function Countdown({ endsAt }: CountdownProps) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      const timeLeft = Math.max(0, Math.floor((endsAt - now) / 1000));
      setRemaining(timeLeft);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 100);

    return () => clearInterval(interval);
  }, [endsAt]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <div className="text-5xl font-mono font-bold">
      {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
    </div>
  );
}