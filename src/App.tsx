import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CqEvent, CqSession, NewCqSession } from '@/types';
import { gridToLatLng } from '@/lib/maidenhead';
import {
  isProfileComplete,
  loadOperatorProfile,
  needsCityPrompt,
  parseOperatorPower,
  saveOperatorProfile,
} from '@/lib/operatorProfile';
import { fetchOperatorPower, persistOperatorPower } from '@/lib/operatorProfileSync';
import { useApp } from '@/context/AppContext';
import { useSessions } from '@/hooks/useSessions';
import { useNets } from '@/hooks/useNets';
import { useNotifications } from '@/hooks/useNotifications';
import { useAllstarMonitor } from '@/hooks/useAllstarMonitor';
import { useCatControl, type CatTelemetry } from '@/hooks/useCatControl';
import Header from '@/components/Header';
import TabBar, { Tab } from '@/components/TabBar';
import ActiveUsers from '@/components/ActiveUsers';
import MapView from '@/components/MapView';
import CallCqForm from '@/components/CallCqForm';
import Toasts, { ToastItem } from '@/components/Toasts';
import ConfirmDialog from '@/components/ConfirmDialog';
import NetManager from '@/components/NetManager';
import LoginScreen from '@/components/LoginScreen';
import TodaysReport from '@/components/TodaysReport';
import CallsignModal from '@/components/CallsignModal';
import CatSettingsModal from '@/components/CatSettingsModal';
import { useServerUtcNow } from '@/hooks/useServerUtcNow';
import { getLiveNet } from '@/lib/liveNetSchedule';
import { Calendar } from 'lucide-react';

export default function App() {
  const { t, lang } = useApp();
  const {
    sessions,
    loading,
    error,
    createSession,
    submitReport,
    deleteReport,
    deleteSession,
    hasReported,
    getReportsForSession,
  } = useSessions();
  const nets = useNets();
  const { permission, requestPermission, alert } = useNotifications();
  const { status: allmonStatus } = useAllstarMonitor();

  const [tab, setTab] = useState<Tab>('active');
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [pendingDelete, setPendingDelete] = useState<CqSession | null>(null);
  const [showTodaysReport, setShowTodaysReport] = useState(false);
  const [showCatSettings, setShowCatSettings] = useState(false);

  const savedProfile = loadOperatorProfile();
  const [myCallsign, setMyCallsignState] = useState(savedProfile.callsign);
  const [myGridsquare, setMyGridsquareState] = useState(savedProfile.gridsquare);
  const [myCity, setMyCityState] = useState(savedProfile.city);
  const [myPower, setMyPowerState] = useState(savedProfile.power);
  const [myPos, setMyPosState] = useState<{ lat: number; lng: number } | null>(() => {
    const raw = localStorage.getItem('scq_pos');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        /* ignore */
      }
    }
    return gridToLatLng(savedProfile.gridsquare);
  });

  const pushToast = useCallback((toast: ToastItem) => {
    setToasts((prev) => [...prev.slice(-3), toast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== toast.id));
    }, 6000);
  }, []);

  const handleCatSettled = useCallback(async (telemetry: CatTelemetry) => {
    const coords = gridToLatLng(myGridsquare);
    const payload: NewCqSession = {
      callsign: myCallsign,
      gridsquare: myGridsquare.trim().toUpperCase(),
      band: telemetry.band || '20m',
      mode: telemetry.mode || 'USB',
      frequency: telemetry.frequency,
      power: telemetry.power || '',
      antenna: 'Dipole',
      city: myCity,
      country: '',
      comments: '',
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
    };
    const res = await createSession(payload);
    pushToast({
      id: `cat-${Date.now()}`,
      kind: 'new_cq',
      title: res.error ? t('reportError') : t('catAutoSubmit'),
      message: res.error ? '' : `SILENT CQ automatically updated to ${telemetry.frequency} MHz (${telemetry.mode})`,
    });
  }, [pushToast, t, myCallsign, myGridsquare, myCity, createSession]);

  const handleVfoMove = useCallback(() => {
    supabase
      .from('cq_sessions')
      .update({ active: false })
      .eq('callsign', myCallsign)
      .eq('active', true)
      .then(() => {});
  }, [myCallsign]);

  const cat = useCatControl(myCallsign, handleCatSettled, handleVfoMove);
  const utcNow = useServerUtcNow();
  const liveNet = utcNow ? getLiveNet(utcNow) : null;

  const myCallsignRef = useRef(myCallsign);
  myCallsignRef.current = myCallsign;
  const langRef = useRef(lang);
  langRef.current = lang;

  const setMyPos = (p: { lat: number; lng: number }) => {
    setMyPosState(p);
    localStorage.setItem('scq_pos', JSON.stringify(p));
  };

  const handleLogin = (callsign: string, gridsquare: string, city: string, power: number, connectRadio: boolean) => {
    setMyCallsignState(callsign);
    setMyGridsquareState(gridsquare);
    setMyCityState(city);
    setMyPowerState(power);
    saveOperatorProfile({ callsign, gridsquare, city, power });
    void persistOperatorPower(callsign, power);
    const coords = gridToLatLng(gridsquare);
    if (coords) setMyPos(coords);
    if (connectRadio) {
      setShowCatSettings(true);
    }
  };

  const dismissToast = (id: string) => setToasts((prev) => prev.filter((x) => x.id !== id));

  useEffect(() => {
    const profile = loadOperatorProfile();
    if (!isProfileComplete(profile)) return;
    let cancelled = false;
    fetchOperatorPower(profile.callsign).then((power) => {
      if (cancelled) return;
      if (power == null) {
        void persistOperatorPower(profile.callsign, profile.power);
        return;
      }
      setMyPowerState(power);
      saveOperatorProfile({ power });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('cq_events_stream')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'cq_events' },
        (payload) => {
          const ev = payload.new as CqEvent;
          const mine =
            !!myCallsignRef.current &&
            ev.from_callsign.toUpperCase() === myCallsignRef.current.toUpperCase();
          if (mine) return;

          const isHe = langRef.current === 'he';
          let title: string;
          if (ev.kind === 'new_cq') {
            title = isHe ? 'קריאת CQ חדשה' : 'New Silent CQ';
          } else if (ev.kind === 'received_ok') {
            title = isHe ? 'אישור קליטה' : 'Acknowledgment';
          } else {
            title = isHe ? 'קוראים לך!' : 'Someone is calling!';
          }

          pushToast({ id: ev.id, kind: ev.kind, title, message: ev.message });
          alert(title, ev.message);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [alert, pushToast]);

  const handleSubmit = async (payload: NewCqSession) => {
    if (payload.city.trim()) {
      setMyCityState(payload.city.trim());
      saveOperatorProfile({ city: payload.city.trim() });
    }
    const parsedPower =
      parseOperatorPower(payload.power) ?? parseOperatorPower(parseInt(payload.power, 10));
    if (parsedPower != null) {
      setMyPowerState(parsedPower);
      saveOperatorProfile({ power: parsedPower });
      void persistOperatorPower(myCallsign, parsedPower);
    }
    if (payload.gridsquare.trim()) {
      const grid = payload.gridsquare.trim().toUpperCase();
      setMyGridsquareState(grid);
      saveOperatorProfile({ gridsquare: grid });
      const coords = gridToLatLng(grid);
      if (coords) setMyPos(coords);
    }
    const res = await createSession(payload);
    return { error: res.error };
  };

  const handleSubmitReport = (session: CqSession, signal: string) => {
    submitReport(session.id, { reporter_callsign: myCallsign, signal_report: signal });
    pushToast({
      id: `report-${Date.now()}`,
      kind: 'received_ok',
      title: t('reportSuccess'),
      message: `${session.callsign}: ${signal}`,
    });
  };

  const handleDeleteReport = (reportId: string, sessionId: string) => {
    deleteReport(reportId, sessionId);
  };

  const requestDelete = (session: CqSession) => setPendingDelete(session);

  const confirmDelete = async () => {
    const session = pendingDelete;
    setPendingDelete(null);
    if (!session) return;
    const ok = await deleteSession(session.id, session.callsign);
    pushToast({
      id: `del-${Date.now()}`,
      kind: 'new_cq',
      title: ok ? t('deleteSuccess') : t('deleteError'),
      message: ok
        ? `${session.callsign} — ${t('deleteSuccess')}`
        : `${session.callsign} — ${t('deleteError')}`,
    });
  };

  const isAdmin = myCallsign.toUpperCase() === '4X1DA';
  const hasActiveCQ = sessions.some(
    (s) => s.callsign.toUpperCase() === myCallsign.toUpperCase()
  );

  const profile = { callsign: myCallsign, gridsquare: myGridsquare, city: myCity, power: myPower };
  if (!isProfileComplete(profile)) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        initialCallsign={myCallsign}
        initialGridsquare={myGridsquare}
        initialCity={myCity}
        initialPower={myPower}
        cityOnly={needsCityPrompt(profile)}
      />
    );
  }

  const connectedCallsigns = sessions.map((s) => s.callsign);

  return (
    <div className="app-bg min-h-screen pb-page-nav sm:pb-10">
      <Header
        notifPermission={permission}
        onEnableNotifications={requestPermission}
        connectedCallsigns={connectedCallsigns}
        allmonStatus={allmonStatus}
        catConnected={cat.connected}
        catFrequency={cat.telemetry?.frequency}
        onOpenCatSettings={() => setShowCatSettings(true)}
        liveNet={liveNet}
      />

      <main className="mx-auto max-w-6xl px-4">
        <div className="hidden sm:block">
          <TabBar active={tab} onChange={setTab} activeCount={sessions.length} isAdmin={isAdmin} />
        </div>

        <div className="mt-4 flex justify-end sm:mt-6">
          <button
            type="button"
            onClick={() => setShowTodaysReport(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3.5 py-2 text-xs font-bold text-white shadow-lg transition hover:bg-slate-900 active:scale-95 dark:bg-white/10 dark:hover:bg-white/15"
          >
            <Calendar className="h-4 w-4" />
            {t('todaysReport')}
          </button>
        </div>

        <div className="mt-4 sm:mt-6">
          {tab === 'active' && (
            <ActiveUsers
              sessions={sessions}
              loading={loading}
              error={error}
              myPos={myPos}
              myCallsign={myCallsign}
              isAdmin={isAdmin}
              hasActiveCQ={hasActiveCQ}
              getReportsForSession={getReportsForSession}
              hasReported={hasReported}
              onSubmitReport={handleSubmitReport}
              onDeleteReport={handleDeleteReport}
              onDelete={requestDelete}
            />
          )}
          {tab === 'map' && <MapView sessions={sessions} myPos={myPos} onAck={() => {}} />}
          {tab === 'call' && (
            <CallCqForm
              onSubmit={handleSubmit}
              onSuccess={() => setTab('active')}
              myCallsign={myCallsign}
              myGridsquare={myGridsquare}
              myCity={myCity}
              myPower={String(myPower)}
              liveNet={liveNet}
              catTelemetry={cat.telemetry}
              catConnected={cat.connected}
              vfoMoving={cat.vfoMoving}
              settlingSeconds={cat.settlingSeconds}
            />
          )}
          {tab === 'nets' && (
            <NetManager
              nets={nets.nets}
              participants={nets.participants}
              reports={nets.reports}
              loading={nets.loading}
              error={nets.error}
              selectedNetId={nets.selectedNetId}
              onSelectNet={nets.setSelectedNetId}
              onCreateNet={nets.createNet}
              onAddParticipant={nets.addParticipant}
              onAddReport={nets.addReport}
              onDeleteNet={nets.deleteNet}
              onDeleteParticipant={nets.deleteParticipant}
              onDeleteReport={nets.deleteReport}
              fetchNetsByDate={nets.fetchNetsByDate}
              fetchNetsInDateRange={nets.fetchNetsInDateRange}
              fetchNetExportData={nets.fetchNetExportData}
              isAdmin={isAdmin}
              onToast={(title, message) =>
                pushToast({
                  id: `net-${Date.now()}-${Math.random()}`,
                  kind: 'new_cq',
                  title,
                  message,
                })
              }
            />
          )}
        </div>
      </main>

      <div className="sm:hidden">
        <TabBar active={tab} onChange={setTab} activeCount={sessions.length} isAdmin={isAdmin} />
      </div>

      <Toasts toasts={toasts} onDismiss={dismissToast} />
      <ConfirmDialog
        open={!!pendingDelete}
        title={t('deleteConfirmTitle')}
        message={t('deleteConfirmMsg')}
        confirmLabel={t('confirmDelete')}
        cancelLabel={t('cancel')}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
      <TodaysReport
        open={showTodaysReport}
        onClose={() => setShowTodaysReport(false)}
        isAdmin={isAdmin}
        adminCallsign={myCallsign}
      />
      <CatSettingsModal open={showCatSettings} onClose={() => setShowCatSettings(false)} cat={cat} />
      <CallsignModal />
    </div>
  );
}
