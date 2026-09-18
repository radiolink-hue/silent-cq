import { useCallback, useEffect, useRef, useState } from 'react';

// Short two-tone "CQ" beep synthesized with the Web Audio API.
function playBeep(ctx: AudioContext) {
  const now = ctx.currentTime;
  const notes = [880, 1320];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const start = now + i * 0.16;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.16);
  });
}

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  const ctxRef = useRef<AudioContext | null>(null);

  const ensureAudio = useCallback(() => {
    if (!ctxRef.current) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AC) ctxRef.current = new AC();
    }
    if (ctxRef.current?.state === 'suspended') ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const requestPermission = useCallback(async () => {
    ensureAudio();
    if (typeof Notification === 'undefined') return;
    try {
      const p = await Notification.requestPermission();
      setPermission(p);
    } catch {
      /* ignore */
    }
  }, [ensureAudio]);

  const alert = useCallback(
    (title: string, body: string) => {
      const ctx = ctxRef.current;
      if (ctx) {
        if (ctx.state === 'suspended') ctx.resume();
        playBeep(ctx);
      }
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          new Notification(title, { body, tag: 'silent-cq' });
        } catch {
          /* some browsers require a SW; ignore */
        }
      }
    },
    []
  );

  useEffect(() => {
    const resume = () => ctxRef.current?.resume();
    window.addEventListener('pointerdown', resume);
    return () => window.removeEventListener('pointerdown', resume);
  }, []);

  return { permission, requestPermission, alert, ensureAudio };
}
