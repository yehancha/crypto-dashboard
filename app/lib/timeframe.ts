export type TimeframeType = '15m' | '1h';

export interface TimeframeConfig {
  type: TimeframeType;
  label: string;
  intervalMinutes: number; // 15 or 60
  maxWindowSize: number; // 15 or 60
  candleLimit: number; // 60 or 600
  candleInterval: string; // '15m' or '1h' for Binance API
  columnCount: number; // 15 or 60
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
};

/**
 * Get timeframe configuration by type
 */
export function getTimeframeConfig(timeframe: TimeframeType): TimeframeConfig {
  return TIMEFRAME_CONFIGS[timeframe];
}
