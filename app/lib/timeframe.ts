export type TimeframeType = '15m' | '1h' | '4h';

export interface TimeframeConfig {
  type: TimeframeType;
  label: string;
  intervalMinutes: number; // 15, 60, or 240
  maxWindowSize: number; // 15, 60, or dynamic for 4h
  candleLimit: number; // 60, 600, or dynamic for 4h
  candleInterval: string; // '15m', '1h', or '4h' for Binance API
  columnCount: number; // 15, 60, or dynamic for 4h
}

export const TIMEFRAME_CONFIGS: Record<TimeframeType, TimeframeConfig> = {
  '15m': {
    type: '15m',
    label: '15m',
    intervalMinutes: 15,
    maxWindowSize: 15,
    candleLimit: 60,
    candleInterval: '15m',
    columnCount: 15,
  },
  '1h': {
    type: '1h',
    label: '1H',
    intervalMinutes: 60,
    maxWindowSize: 60,
    candleLimit: 600,
    candleInterval: '1h',
    columnCount: 60,
  },
  '4h': {
    type: '4h',
    label: '4H',
    intervalMinutes: 240,
    maxWindowSize: 4, // For hourly mode, will be 60 for minute mode
    candleLimit: 672, // For 672 hours of history in hourly mode
    candleInterval: '4h',
    columnCount: 4, // For hourly mode, will be 60 for minute mode
  },
};

/**
 * Get timeframe configuration by type
 */
export function getTimeframeConfig(timeframe: TimeframeType): TimeframeConfig {
  return TIMEFRAME_CONFIGS[timeframe];
}
