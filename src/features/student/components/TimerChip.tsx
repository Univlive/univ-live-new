import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@shared/lib/utils";

interface TimerChipProps {
  initialSeconds: number;
  onTimeUp?: () => void;
  isPaused?: boolean;
  className?: string;
}

export function TimerChip({ initialSeconds, onTimeUp, isPaused = false, className }: TimerChipProps) {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onTimeUp?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused, onTimeUp]);

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const isLow = seconds < 300; // Less than 5 minutes
  const isCritical = seconds < 60; // Less than 1 minute

  const formatTime = (num: number) => num.toString().padStart(2, "0");

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-lg font-semibold transition-colors",
        isCritical
          ? "bg-destructive text-destructive-foreground animate-pulse"
          : isLow
          ? "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400"
          : "bg-primary/10 text-primary",
        className
      )}
    >
      <Clock className="h-5 w-5" />
      {hours > 0 && <span>{formatTime(hours)}:</span>}
      <span>{formatTime(minutes)}:{formatTime(secs)}</span>
    </div>
  );
}
