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
    
    // Calculate time remaining until next candle close
    const calculateTimeRemaining = () => {
      const now = new Date();
      const intervalMinutes = timeframeConfig.intervalMinutes;
      
      let nextInterval: Date;
      
      if (intervalMinutes === 60) {
        // For hourly intervals, calculate minutes until next hour
        nextInterval = new Date(now);
        nextInterval.setUTCHours(nextInterval.getUTCHours() + 1);
        nextInterval.setUTCMinutes(0, 0, 0);
      } else {
        // For other intervals (e.g., 15 minutes)
        const currentMinute = now.getUTCMinutes();
        
        // Calculate the ceiling interval minute
        let nextIntervalMinute = Math.ceil(currentMinute / intervalMinutes) * intervalMinutes;
        
        // Create the next interval time
        nextInterval = new Date(now);
        nextInterval.setUTCMinutes(nextIntervalMinute, 0, 0);
        nextInterval.setUTCSeconds(0, 0);
        
        // If the calculated interval is in the past or at the current moment, 
        // move to the NEXT interval
        // This handles the case where we're at exactly :00, :15, :30, or :45
        const timeDiff = nextInterval.getTime() - now.getTime();
        if (timeDiff <= 0) { // In the past or exactly now
          nextIntervalMinute += intervalMinutes;
          if (nextIntervalMinute >= 60) {
            // Move to next hour
            nextInterval.setUTCHours(nextInterval.getUTCHours() + 1);
            nextInterval.setUTCMinutes(nextIntervalMinute - 60, 0, 0);
          } else {
            nextInterval.setUTCMinutes(nextIntervalMinute, 0, 0);
          }
        }
      }
      
      const diffMs = nextInterval.getTime() - now.getTime();
      return Math.max(0, Math.floor(diffMs / 1000)); // Return seconds
    };

    // Set initial time
    setTimeRemaining(calculateTimeRemaining());

    // Decrement every second
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 0) {
          // When it reaches 0, recalculate to get the next interval
          return calculateTimeRemaining();
        }
        return prev - 1;
      });
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
