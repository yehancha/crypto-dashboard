export type TimeframeType = '15m' | '1h' | '4h' | '1d';

export interface TimeframeConfig {
  type: TimeframeType;
  label: string;
  intervalMinutes: number; // 15, 60, or 240
  maxWindowSize: number; // 15, 60, or dynamic for 4h
  candleLimit: number; // 60, 600, or dynamic for 4h
  candleInterval: string; // '15m', '1h', '4h', or '1d' for Binance API
  columnCount: number; // 15, 60, or dynamic for 4h/1d
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
  '1d': {
    type: '1d',
    label: '1D',
    intervalMinutes: 1440,
    // For 1D we use 1h windows in hourly mode and 1m windows in minute mode.
    // Base config reflects hourly mode; effective window sizes are handled by helpers.
    maxWindowSize: 24,
    // Candle limit is in hours for hourly mode (e.g. up to 672h of history),
    // but effective limits for 1m/1h data are computed in hooks.
    candleLimit: 672,
    candleInterval: '1d',
    columnCount: 24,
  },
};

/**
 * Get timeframe configuration by type
 */
export function getTimeframeConfig(timeframe: TimeframeType): TimeframeConfig {
  return TIMEFRAME_CONFIGS[timeframe];
}
