'use client';

interface TimerBarProps {
  timeLeft: number;
  totalSeconds: number;
  label?: string;
  className?: string;
}

export default function TimerBar({ timeLeft, totalSeconds, label = 'Temps restant', className = '' }: TimerBarProps) {
  const percent = totalSeconds > 0 ? Math.max(0, (timeLeft / totalSeconds) * 100) : 0;
  const isLow = timeLeft <= 10;

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-[#94A3B8]">{label}</span>
        <span className={`text-sm font-bold tabular-nums ${isLow ? 'text-red-500' : 'text-[#F8FAFC]'}`}>
          {timeLeft}s
        </span>
      </div>
      <div className="h-2 w-full bg-[#334155] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${
            isLow ? 'bg-red-500' : 'bg-[#3B82F6]'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
