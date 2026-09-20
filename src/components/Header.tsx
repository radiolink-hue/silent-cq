import { useEffect, useRef, useState } from 'react';
import { Radio, Sun, Moon, Share2, MessageCircle, Send, Link2, Check, Bell, BellRing, Activity } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import Toggle from '@/components/Toggle';
import type { AllmonStatus } from '@/hooks/useAllstarMonitor';
import type { LiveNetSchedule } from '@/lib/liveNetSchedule';
import ActiveNetBanner from '@/components/ActiveNetBanner';

interface HeaderProps {
  notifPermission: NotificationPermission;
  onEnableNotifications: () => void;
  connectedCallsigns: string[];
  allmonStatus: AllmonStatus;
  catConnected: boolean;
  catFrequency?: string;
  onOpenCatSettings: () => void;
  liveNet: LiveNetSchedule | null;
}

export default function Header({ notifPermission, onEnableNotifications, connectedCallsigns, allmonStatus, catConnected, catFrequency, onOpenCatSettings, liveNet }: HeaderProps) {
  const { t, lang, toggleLang, theme, toggleTheme } = useApp();
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);

  const url = typeof window !== 'undefined' ? window.location.href : '';
  const shareText =
    lang === 'he'
      ? 'הצטרפו ל-SILENT CQ — קריאת CQ שקטה לחובבי רדיו'
      : 'Join SILENT CQ — Silent CQ for Ham Radio operators';

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setShareOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const notifOn = notifPermission === 'granted';

  return (
    <header className="sticky top-0 z-40 glass-strong">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 gap-y-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 max-[420px]:min-w-full sm:gap-3">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-lg shadow-brand-500/30 sm:h-11 sm:w-11">
            <Radio className="h-5 w-5 sm:h-6 sm:w-6" />
            <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-brand-400" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-brand-400 ring-2 ring-white dark:ring-slate-900" />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold leading-tight sm:text-xl">
              {t('appTitle')}
            </h1>
            <p className="hidden truncate text-xs text-slate-500 dark:text-slate-400 min-[380px]:block">{t('appTagline')}</p>
          </div>
        </div>

        <div className="flex max-w-full flex-wrap items-center justify-end gap-1 max-[420px]:w-full sm:ms-auto sm:gap-2">
          {connectedCallsigns.length > 0 && (
            <div className="hidden max-w-[200px] truncate text-xs font-semibold text-slate-500 dark:text-slate-400 lg:block">
              {t('connectedStations')}: {connectedCallsigns.join(', ')}
            </div>
          )}

          <div
            className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold transition sm:inline-flex"
            style={{
              background:
                allmonStatus === 'live'
                  ? 'rgba(16,185,129,0.15)'
                  : allmonStatus === 'fallback'
                    ? 'rgba(245,158,11,0.15)'
                    : 'rgba(100,116,139,0.15)',
              color:
                allmonStatus === 'live'
                  ? '#059669'
                  : allmonStatus === 'fallback'
                    ? '#d97706'
                    : '#64748b',
            }}
            title={
              allmonStatus === 'live'
                ? t('allmonLive')
                : allmonStatus === 'fallback'
                  ? t('allmonFallback')
                  : t('allmonIdle')
            }
          >
            <Activity
              className={`h-3.5 w-3.5 ${allmonStatus === 'live' ? 'animate-pulse' : ''}`}
            />
            <span className="hidden lg:inline">
              {allmonStatus === 'live'
                ? t('allmonLive')
                : allmonStatus === 'fallback'
                  ? t('allmonFallback')
                  : t('allmonIdle')}
            </span>
          </div>

          <button
            type="button"
            onClick={onEnableNotifications}
            title={notifOn ? t('notificationsOn') : t('enableNotifications')}
            className={`hidden items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold transition sm:inline-flex ${
              notifOn
                ? 'bg-brand-500/15 text-brand-600 dark:text-brand-300'
                : 'glass hover:border-brand-400/60'
            }`}
          >
            {notifOn ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
            {notifOn ? t('notificationsOn') : t('enableNotifications')}
          </button>

          {/* Phase 2 - Omni-Rig implementation pending - hidden to prevent TX lockup risk */}
          {/*
          <button
            type="button"
            onClick={onOpenCatSettings}
            title={t('catSettings')}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full p-2 text-xs font-bold transition sm:px-3 sm:py-2 ${
              catConnected
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : 'glass hover:border-brand-400/60'
            }`}
          >
            <Settings className={`h-4 w-4 ${catConnected ? 'animate-pulse' : ''}`} />
            <span className="hidden lg:inline">
              {catConnected && catFrequency
                ? `${t('catLiveFreq')}: ${catFrequency} MHz`
                : t('catSettings')}
            </span>
          </button>
          */}

          <Toggle
            checked={lang === 'en'}
            onChange={toggleLang}
            labelOff="עב"
            labelOn="EN"
            ariaLabel="Language"
          />
          <Toggle
            checked={theme === 'light'}
            onChange={toggleTheme}
            labelOff={t('dark')}
            labelOn={t('light')}
            iconOff={<Moon className="h-3.5 w-3.5" />}
            iconOn={<Sun className="h-3.5 w-3.5" />}
            ariaLabel="Theme"
          />

          <div className="relative" ref={shareRef}>
            <button
              type="button"
              onClick={() => setShareOpen((o) => !o)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-500 p-2 text-xs font-bold text-white shadow transition hover:bg-brand-600 sm:px-3 sm:py-2"
            >
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline">{t('shareApp')}</span>
            </button>
            {shareOpen && (
              <div className="absolute end-0 mt-2 w-52 animate-slide-in overflow-hidden rounded-2xl glass-strong p-1.5 shadow-xl">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${url}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition hover:bg-brand-500/10"
                >
                  <MessageCircle className="h-4 w-4 text-green-500" />
                  {t('shareWhatsapp')}
                </a>
                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition hover:bg-brand-500/10"
                >
                  <Send className="h-4 w-4 text-sky-500" />
                  {t('shareTelegram')}
                </a>
                <button
                  type="button"
                  onClick={copyUrl}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition hover:bg-brand-500/10"
                >
                  {copied ? <Check className="h-4 w-4 text-brand-500" /> : <Link2 className="h-4 w-4 text-slate-400" />}
                  {copied ? t('copied') : t('shareCopy')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <ActiveNetBanner net={liveNet} />
    </header>
  );
}
