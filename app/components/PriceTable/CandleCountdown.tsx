'use client';

import { useState, useEffect } from 'react';
import { type TimeframeType, getTimeframeConfig } from '../../lib/timeframe';
import { getMinutesUntilNextInterval } from '../../utils/price';

interface CandleCountdownProps {
  timeframe: TimeframeType;
}

export default function CandleCountdown({ timeframe }: CandleCountdownProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  useEffect(() => {
    const timeframeConfig = getTimeframeConfig(timeframe);
    
    // Calculate time remaining until next candle close using getMinutesUntilNextInterval
    const calculateTimeRemaining = () => {
      const minutesRemaining = getMinutesUntilNextInterval(timeframeConfig.intervalMinutes);
      // Convert minutes to seconds
      return Math.max(0, Math.floor(minutesRemaining * 60));
    };

    // Set initial time
    setTimeRemaining(calculateTimeRemaining());

    // Recalculate every second to prevent drift
    const interval = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining());
    }, 1000);

    return () => clearInterval(interval);
  }, [timeframe]);

  // Format time as HH:MM:SS or MM:SS
  const formatTime = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  };

  return (
    <div className="text-xl font-bold text-zinc-600 dark:text-zinc-400">
      {formatTime(timeRemaining)}
    </div>
  );
}
