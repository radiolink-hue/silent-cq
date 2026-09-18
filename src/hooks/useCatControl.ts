import { useCallback, useEffect, useRef, useState } from 'react';
import { BAND_FREQ_RANGES } from '@/types';
import { supabase } from '@/lib/supabase';

export type RadioProtocol = 'icom' | 'yaesu_legacy' | 'yaesu_modern' | 'kenwood_elecraft' | 'websocket';
export type CatConnectionType = 'serial' | 'websocket' | 'none';

export interface CatTelemetry {
  frequency: string;
  mode: string;
  power: string;
  band: string;
}

export interface CatSettings {
  radioModel: string;
  protocol: RadioProtocol;
  baudRate: number;
  stopBits: 1 | 2;
  civAddress: string;
  wsUrl: string;
}

export interface RadioModel {
  id: string;
  label: string;
  protocol: RadioProtocol;
  civAddress: string;
  defaultBaud: number;
  defaultStopBits: 1 | 2;
  defaultWsUrl: string;
}

export const RADIO_MODELS: RadioModel[] = [
  { id: 'icom_7300', label: 'Icom IC-7300 (CI-V: 94)', protocol: 'icom', civAddress: '94', defaultBaud: 19200, defaultStopBits: 1, defaultWsUrl: '' },
  { id: 'icom_7200', label: 'Icom IC-7200 (CI-V: 76)', protocol: 'icom', civAddress: '76', defaultBaud: 19200, defaultStopBits: 1, defaultWsUrl: '' },
  { id: 'icom_705', label: 'Icom IC-705 (CI-V: A4)', protocol: 'icom', civAddress: 'A4', defaultBaud: 4800, defaultStopBits: 1, defaultWsUrl: '' },
  { id: 'icom_7100', label: 'Icom IC-7100 (CI-V: 88)', protocol: 'icom', civAddress: '88', defaultBaud: 19200, defaultStopBits: 1, defaultWsUrl: '' },
  { id: 'icom_9700', label: 'Icom IC-9700 (CI-V: A2)', protocol: 'icom', civAddress: 'A2', defaultBaud: 19200, defaultStopBits: 1, defaultWsUrl: '' },
  { id: 'yaesu_legacy', label: 'Yaesu Legacy (FT-950, FT-2000, FT-450D, FT-857D, FT-897D)', protocol: 'yaesu_legacy', civAddress: '', defaultBaud: 9600, defaultStopBits: 2, defaultWsUrl: '' },
  { id: 'yaesu_modern', label: 'Yaesu Modern (FT-991A, FT-891, FTDX10)', protocol: 'yaesu_modern', civAddress: '', defaultBaud: 9600, defaultStopBits: 1, defaultWsUrl: '' },
  { id: 'kenwood_elecraft', label: 'Kenwood / Elecraft (TS-590, TS-2000, K3, KX3)', protocol: 'kenwood_elecraft', civAddress: '', defaultBaud: 9600, defaultStopBits: 1, defaultWsUrl: '' },
  { id: 'shared_proxy', label: 'Shared Proxy (Omni-Rig / Flrig / rigctld)', protocol: 'websocket', civAddress: '', defaultBaud: 19200, defaultStopBits: 1, defaultWsUrl: 'ws://127.0.0.1:12345' },
];

const DEFAULT_RADIO = RADIO_MODELS[0];

interface SerialPortLike {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open(options: {
    baudRate: number;
    dataBits?: number;
    stopBits?: number;
    parity?: string;
    dataTerminalReady?: boolean;
    requestToSend?: boolean;
  }): Promise<void>;
  close(): Promise<void>;
}

interface SerialNavigator {
  requestPort(): Promise<SerialPortLike>;
}

interface CatState {
  connected: boolean;
  connectionType: CatConnectionType;
  protocol: RadioProtocol;
  telemetry: CatTelemetry | null;
  settledTelemetry: CatTelemetry | null;
  vfoMoving: boolean;
  settlingSeconds: number;
  error: string | null;
}

const DEFAULT_SETTINGS: CatSettings = {
  radioModel: DEFAULT_RADIO.id,
  protocol: DEFAULT_RADIO.protocol,
  baudRate: DEFAULT_RADIO.defaultBaud,
  stopBits: DEFAULT_RADIO.defaultStopBits,
  civAddress: DEFAULT_RADIO.civAddress,
  wsUrl: DEFAULT_RADIO.defaultWsUrl,
};

const SETTLE_MS = 20_000;
const POLL_MS = 1_000;
const CMD_DELAY_MS = 100;
const KEEPALIVE_MS = 50 * 60 * 1000;

function loadSettings(): CatSettings {
  try {
    const raw = localStorage.getItem('scq_cat_settings');
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT_SETTINGS;
}

function saveSettings(s: CatSettings) {
  localStorage.setItem('scq_cat_settings', JSON.stringify(s));
}

export function getRadioModel(id: string): RadioModel {
  return RADIO_MODELS.find((r) => r.id === id) ?? DEFAULT_RADIO;
}

export function freqToBand(freqStr: string): string {
  const f = parseFloat(freqStr);
  if (isNaN(f)) return '';
  for (const [band, range] of Object.entries(BAND_FREQ_RANGES)) {
    if (f >= range.min && f <= range.max) return band;
  }
  return '';
}

function mapMode(rawMode: string): string {
  const m = rawMode.toUpperCase().trim();
  if (m.includes('LSB') || m === '1') return 'LSB';
  if (m.includes('USB') || m === '2') return 'USB';
  if (m.includes('CW') || m === '3') return 'CW';
  if (m.includes('AM') || m === '4') return 'AM';
  if (m.includes('FM') || m === '5') return 'FM';
  if (m.includes('FT8')) return 'FT8';
  if (m.includes('FT4')) return 'FT4';
  if (m.includes('RTTY')) return 'RTTY';
  if (m.includes('PSK')) return 'PSK31';
  if (m.includes('SSTV')) return 'SSTV';
  return m || 'USB';
}

function parseIcomResponse(data: string): Partial<CatTelemetry> {
  const result: Partial<CatTelemetry> = {};
  const freqMatch = data.match(/03([0-9A-Fa-f]{10})/);
  if (freqMatch) {
    const bcd = freqMatch[1];
    let freq = '';
    for (let i = bcd.length - 2; i >= 0; i -= 2) {
      freq += bcd.substr(i, 2);
    }
    const hz = parseInt(freq, 10);
    if (!isNaN(hz)) {
      result.frequency = (hz / 1_000_000).toFixed(3);
      result.band = freqToBand(result.frequency);
    }
  }
  const modeMatch = data.match(/04([0-9A-Fa-f]{2})/);
  if (modeMatch) {
    const modeCode = parseInt(modeMatch[1], 16);
    const modes = ['LSB', 'USB', 'CW', 'CW-R', 'AM', 'FM', 'FM-R', 'LSB-R'];
    result.mode = modes[modeCode] ?? 'USB';
  }
  return result;
}

function parseAsciiResponse(data: string): Partial<CatTelemetry> {
  const result: Partial<CatTelemetry> = {};
  const faMatch = data.match(/FA(\d+);/);
  if (faMatch) {
    const hz = parseInt(faMatch[1], 10);
    if (!isNaN(hz)) {
      result.frequency = (hz / 1_000_000).toFixed(3);
      result.band = freqToBand(result.frequency);
    }
  }
  const mdMatch = data.match(/MD(\d+);/);
  if (mdMatch) {
    const modeCode = parseInt(mdMatch[1], 10);
    const modes = ['LSB', 'USB', 'CW', 'CW-R', 'AM', 'FM', 'FM-R', 'LSB-R'];
    result.mode = modes[modeCode] ?? 'USB';
  }
  const pcMatch = data.match(/PC(\d+);/);
  if (pcMatch) {
    result.power = pcMatch[1];
  }
  return result;
}

export function useCatControl(
  callsign: string,
  onSettled?: (telemetry: CatTelemetry) => void,
  onVfoMove?: () => void,
) {
  const [settings, setSettings] = useState<CatSettings>(loadSettings);
  const [state, setState] = useState<CatState>({
    connected: false,
    connectionType: 'none',
    protocol: settings.protocol,
    telemetry: null,
    settledTelemetry: null,
    vfoMoving: false,
    settlingSeconds: 0,
    error: null,
  });

  const serialPortRef = useRef<SerialPortLike | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const writerRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const keepAliveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastFreqRef = useRef<string>('');
  const lastModeRef = useRef<string>('');
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;
  const onVfoMoveRef = useRef(onVfoMove);
  onVfoMoveRef.current = onVfoMove;

  const serialNavigator = typeof navigator !== 'undefined'
    ? (navigator as Navigator & { serial?: SerialNavigator }).serial
    : undefined;
  const webSerialSupported = !!serialNavigator;

  const updateSettings = useCallback((s: CatSettings) => {
    setSettings(s);
    saveSettings(s);
  }, []);

  const buildPollCommands = useCallback((protocol: RadioProtocol, civAddress: string): string[] => {
    const civ = civAddress || '94';
    switch (protocol) {
      case 'icom':
        return [`FEFE${civ}E003FD`, `FEFE${civ}E004FD`];
      case 'yaesu_legacy':
      case 'yaesu_modern':
        return ['FA;', 'MD;', 'PC;'];
      case 'kenwood_elecraft':
        return ['FA;', 'MD;', 'PC;'];
      case 'websocket':
        return ['FA;', 'MD;', 'PC;'];
    }
  }, []);

  const parseResponse = useCallback((data: string, protocol: RadioProtocol): Partial<CatTelemetry> => {
    switch (protocol) {
      case 'icom':
        return parseIcomResponse(data);
      default:
        return parseAsciiResponse(data);
    }
  }, []);

  const sendCommand = useCallback(async (cmd: string): Promise<string> => {
    if (serialPortRef.current && writerRef.current && readerRef.current) {
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      if (settingsRef.current.protocol === 'icom') {
        const bytes = new Uint8Array(cmd.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
        await writerRef.current.write(bytes);
      } else {
        await writerRef.current.write(encoder.encode(cmd + '\n'));
      }
      try {
        const { value, done } = await readerRef.current.read();
        if (done) return '';
        if (settingsRef.current.protocol === 'icom') {
          return Array.from(value).map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join('');
        }
        return decoder.decode(value);
      } catch {
        return '';
      }
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return new Promise<string>((resolve) => {
        const timeout = setTimeout(() => resolve(''), 2000);
        const handler = (event: MessageEvent) => {
          clearTimeout(timeout);
          wsRef.current!.removeEventListener('message', handler);
          resolve(typeof event.data === 'string' ? event.data : '');
        };
        wsRef.current!.addEventListener('message', handler);
        wsRef.current!.send(cmd);
      });
    }
    return '';
  }, []);

  const clearDebounce = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (settleCountdownRef.current) {
      clearInterval(settleCountdownRef.current);
      settleCountdownRef.current = null;
    }
  }, []);

  const startSettleCountdown = useCallback(() => {
    if (settleCountdownRef.current) clearInterval(settleCountdownRef.current);
    let remaining = Math.ceil(SETTLE_MS / 1000);
    setState((prev) => ({ ...prev, settlingSeconds: remaining }));
    settleCountdownRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        if (settleCountdownRef.current) clearInterval(settleCountdownRef.current);
        settleCountdownRef.current = null;
        setState((prev) => ({ ...prev, settlingSeconds: 0 }));
      } else {
        setState((prev) => ({ ...prev, settlingSeconds: remaining }));
      }
    }, 1000);
  }, []);

  const pollTelemetry = useCallback(async () => {
    const protocol = settingsRef.current.protocol;
    const civAddress = settingsRef.current.civAddress;
    const commands = buildPollCommands(protocol, civAddress);
    let combined: Partial<CatTelemetry> = {};

    for (let i = 0; i < commands.length; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, CMD_DELAY_MS));
      const response = await sendCommand(commands[i]);
      if (response) {
        combined = { ...combined, ...parseResponse(response, protocol) };
      }
    }

    if (combined.frequency || combined.mode || combined.power) {
      const telemetry: CatTelemetry = {
        frequency: combined.frequency || '',
        mode: mapMode(combined.mode || ''),
        power: combined.power || '',
        band: combined.band || freqToBand(combined.frequency || ''),
      };

      const initialSync = !lastFreqRef.current && !lastModeRef.current;
      const freqChanged = telemetry.frequency && telemetry.frequency !== lastFreqRef.current;
      const modeChanged = telemetry.mode && telemetry.mode !== lastModeRef.current;
      const vfoMoved = !initialSync && !!(freqChanged || modeChanged);

      setState((prev) => ({ ...prev, telemetry }));

      if (initialSync) {
        lastFreqRef.current = telemetry.frequency;
        lastModeRef.current = telemetry.mode;
        setState((prev) => ({ ...prev, settledTelemetry: telemetry, vfoMoving: false, settlingSeconds: 0 }));
      } else if (vfoMoved) {
        lastFreqRef.current = telemetry.frequency;
        lastModeRef.current = telemetry.mode;
        clearDebounce();
        setState((prev) => ({ ...prev, vfoMoving: true }));
        startSettleCountdown();
        if (onVfoMoveRef.current) onVfoMoveRef.current();
        debounceTimerRef.current = setTimeout(() => {
          setState((prev) => ({
            ...prev,
            vfoMoving: false,
            settlingSeconds: 0,
            settledTelemetry: prev.telemetry,
          }));
          if (onSettledRef.current && telemetry.frequency) {
            onSettledRef.current(telemetry);
          }
        }, SETTLE_MS);
      } else if (telemetry.frequency && !debounceTimerRef.current) {
        setState((prev) => ({
          ...prev,
          vfoMoving: false,
          settlingSeconds: 0,
          settledTelemetry: prev.telemetry,
        }));
      }
    }
  }, [buildPollCommands, parseResponse, sendCommand, clearDebounce, startSettleCountdown]);

  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollTelemetry();
    pollIntervalRef.current = setInterval(pollTelemetry, POLL_MS);
  }, [pollTelemetry]);

  const startKeepAlive = useCallback(() => {
    if (keepAliveIntervalRef.current) clearInterval(keepAliveIntervalRef.current);
    keepAliveIntervalRef.current = setInterval(() => {
      supabase
        .from('cq_sessions')
        .update({ created_at: new Date().toISOString() })
        .eq('callsign', callsign)
        .eq('active', true)
        .then(() => {});
    }, KEEPALIVE_MS);
  }, [callsign]);

  const stopKeepAlive = useCallback(() => {
    if (keepAliveIntervalRef.current) {
      clearInterval(keepAliveIntervalRef.current);
      keepAliveIntervalRef.current = null;
    }
  }, []);

  const connectSerial = useCallback(async (): Promise<boolean> => {
    if (!webSerialSupported || !serialNavigator) return false;
    try {
      const port = await serialNavigator.requestPort();
      await port.open({
        baudRate: settingsRef.current.baudRate,
        stopBits: settingsRef.current.stopBits,
        dataBits: 8,
        parity: 'none',
        dataTerminalReady: false,
        requestToSend: false,
      });
      serialPortRef.current = port;

      if (port.readable) {
        readerRef.current = port.readable.getReader();
      }
      if (port.writable) {
        writerRef.current = port.writable.getWriter();
      }

      setState((prev) => ({
        ...prev,
        connected: true,
        connectionType: 'serial',
        protocol: settingsRef.current.protocol,
        error: null,
      }));

      startPolling();
      startKeepAlive();
      return true;
    } catch (err) {
      setState((prev) => ({ ...prev, error: err instanceof Error ? err.message : 'Connection failed' }));
      return false;
    }
  }, [webSerialSupported, serialNavigator, startPolling, startKeepAlive]);

  const connectWebSocket = useCallback(async (): Promise<boolean> => {
    try {
      const ws = new WebSocket(settingsRef.current.wsUrl);
      wsRef.current = ws;

      await new Promise<void>((resolve, reject) => {
        ws.addEventListener('open', () => resolve());
        ws.addEventListener('error', () => reject(new Error('WebSocket connection failed')));
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });

      setState((prev) => ({
        ...prev,
        connected: true,
        connectionType: 'websocket',
        protocol: settingsRef.current.protocol,
        error: null,
      }));

      startPolling();
      startKeepAlive();
      return true;
    } catch (err) {
      setState((prev) => ({ ...prev, error: err instanceof Error ? err.message : 'WebSocket connection failed' }));
      return false;
    }
  }, [startPolling, startKeepAlive]);

  const connect = useCallback(async (): Promise<boolean> => {
    if (settingsRef.current.protocol === 'websocket') {
      return connectWebSocket();
    }
    return connectSerial();
  }, [connectSerial, connectWebSocket]);

  const disconnect = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    clearDebounce();
    stopKeepAlive();

    if (readerRef.current) {
      readerRef.current.releaseLock();
      readerRef.current = null;
    }
    if (writerRef.current) {
      writerRef.current.releaseLock();
      writerRef.current = null;
    }
    if (serialPortRef.current) {
      serialPortRef.current.close().catch(() => {});
      serialPortRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    lastFreqRef.current = '';
    lastModeRef.current = '';

    setState({
      connected: false,
      connectionType: 'none',
      protocol: settingsRef.current.protocol,
      telemetry: null,
      settledTelemetry: null,
      vfoMoving: false,
      settlingSeconds: 0,
      error: null,
    });
  }, [clearDebounce, stopKeepAlive]);

  useEffect(() => {
    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    ...state,
    settings,
    updateSettings,
    connect,
    disconnect,
    webSerialSupported,
  };
}
