import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RadioTower } from 'lucide-react';
import { CqSession } from '@/types';
import { useApp } from '@/context/AppContext';

interface MapViewProps {
  sessions: CqSession[];
  myPos: { lat: number; lng: number } | null;
  onAck: (session: CqSession, kind: 'received_ok' | 'calling_you') => void;
}

function markerIcon(callsign: string) {
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;transform:translate(-50%,-100%)">
      <div style="background:#3b82f6;color:#fff;font:700 11px/1 'Heebo',sans-serif;padding:5px 9px;border-radius:9999px;white-space:nowrap;box-shadow:0 6px 16px rgba(59,130,246,.45);border:2px solid #fff">${callsign}</div>
      <div style="width:10px;height:10px;background:#3b82f6;transform:rotate(45deg);margin:-5px auto 0;border-right:2px solid #fff;border-bottom:2px solid #fff"></div>
    </div>`,
    iconSize: [0, 0],
  });
}

export default function MapView({ sessions, myPos }: MapViewProps) {
  const { t, theme, lang } = useApp();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const located = sessions.filter((s) => s.lat != null && s.lng != null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: myPos ? [myPos.lat, myPos.lng] : [31.5, 34.9],
      zoom: myPos ? 10 : 7,
      zoomControl: true,
      attributionControl: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, [myPos]);

  useEffect(() => {
    const layer = layerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();

    located.forEach((s) => {
      const marker = L.marker([s.lat as number, s.lng as number], { icon: markerIcon(s.callsign) });

      const el = document.createElement('div');
      el.dir = lang === 'he' ? 'rtl' : 'ltr';
      el.style.minWidth = '190px';
      el.style.fontFamily = "'Heebo',sans-serif";
      const loc = [s.city].filter(Boolean).join(', ');
      el.innerHTML = `
        <div style="font:700 18px/1.1 'JetBrains Mono',monospace;margin-bottom:4px"><a href="https://www.qrz.com/db/${encodeURIComponent(s.callsign)}" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:none">${s.callsign}</a></div>
        <div style="font-size:12px;color:#64748b;margin-bottom:8px">${loc}</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;font-size:11px">
          ${s.band ? `<span style="background:#3b82f622;color:#2563eb;padding:2px 8px;border-radius:9999px">${s.band}</span>` : ''}
          ${s.mode ? `<span style="background:#3b82f622;color:#2563eb;padding:2px 8px;border-radius:9999px">${s.mode}</span>` : ''}
          ${s.frequency ? `<span style="background:#3b82f622;color:#2563eb;padding:2px 8px;border-radius:9999px">${s.frequency} MHz</span>` : ''}
        </div>`;
      marker.bindPopup(el);
      marker.addTo(layer);
    });
  }, [located, t, lang]);

  useEffect(() => {
    setTimeout(() => mapRef.current?.invalidateSize(), 100);
  }, [theme]);

  return (
    <div className="relative overflow-hidden rounded-3xl glass p-1">
      <div ref={containerRef} className="h-[65vh] min-h-[420px] w-full rounded-[20px]" />
      {located.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-[500] flex flex-col items-center justify-center gap-3 rounded-3xl bg-white/60 text-center text-slate-500 backdrop-blur-sm dark:bg-slate-950/60 dark:text-slate-400">
          <RadioTower className="h-10 w-10 text-brand-500" />
          <p className="max-w-xs px-6 font-medium">{t('mapEmpty')}</p>
        </div>
      )}
    </div>
  );
}
