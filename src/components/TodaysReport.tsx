import { useCallback, useEffect, useState } from 'react';
import { Calendar, X, Loader2, FileDown, Trash2, NotebookPen } from 'lucide-react';
import { CqSession, CqSignalReport } from '@/types';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';
import jsPDF from 'jspdf';
import { sanitizeForPdf, pdfTime } from '@/lib/pdfSanitize';

interface TodaysReportProps {
  open: boolean;
  onClose: () => void;
  isAdmin?: boolean;
  adminCallsign?: string;
}

interface SessionWithReports {
  session: CqSession;
  reports: CqSignalReport[];
}

const NOTEBOOKLM_PROMPT = `Act as an expert Amateur Radio Data Analyst. Based strictly on the uploaded daily log Markdown file:
1. Executive Summary & Operator Leaderboard:
   - Count total spots, unique stations, and spots that received reciprocal signal reports vs. self-spots.
   - Rank top operators and top reporting stations.
2. Grafana-Style Performance Matrix:
   - Create tables showing band utilization, peak activity time windows, and distribution of signal reports (e.g., 5-9 vs 5-9+10).
3. 4-Slide Presentation Deck:
   - Slide 1: Daily Activity Highlights
   - Slide 2: Propagation & Path Reports
   - Slide 3: Operator & Band Leaderboard
   - Slide 4: Strategic Recommendations for Local Nets & Unused Bands`;

export default function TodaysReport({ open, onClose, isAdmin, adminCallsign }: TodaysReportProps) {
  const { t } = useApp();
  const [data, setData] = useState<SessionWithReports[]>([]);
  const [loading, setLoading] = useState(false);
  const [notebookStatus, setNotebookStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle');

  const loadData = useCallback(async () => {
    setLoading(true);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: sessions } = await supabase
      .from('cq_sessions')
      .select('*')
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false });
    if (!sessions) {
      setLoading(false);
      return;
    }
    const sessionIds = sessions.map((s) => s.id);
    if (sessionIds.length === 0) {
      setData([]);
      setLoading(false);
      return;
    }
    const { data: reports } = await supabase
      .from('cq_signal_reports')
      .select('*')
      .in('session_id', sessionIds)
      .order('created_at', { ascending: false });
    const reportMap = new Map<string, CqSignalReport[]>();
    for (const r of (reports ?? []) as CqSignalReport[]) {
      const list = reportMap.get(r.session_id) ?? [];
      list.push(r);
      reportMap.set(r.session_id, list);
    }
    setData(
      (sessions as CqSession[]).map((s) => ({
        session: s,
        reports: reportMap.get(s.id) ?? [],
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    loadData();

    const channel = supabase
      .channel('todays_report_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cq_sessions' },
        () => loadData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cq_signal_reports' },
        () => loadData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, loadData]);

  const handleDeleteReport = async (reportId: string, sessionId: string) => {
    if (!isAdmin || !adminCallsign) return;
    const { data } = await supabase.rpc('admin_delete_report', {
      p_report_id: reportId,
      p_admin_callsign: adminCallsign,
    });
    if (data && data.ok) {
      setData((prev) =>
        prev.map((entry) =>
          entry.session.id === sessionId
            ? { ...entry, reports: entry.reports.filter((r) => r.id !== reportId) }
            : entry
        )
      );
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!isAdmin || !adminCallsign) return;
    const { data } = await supabase.rpc('admin_delete_session', {
      p_session_id: sessionId,
      p_admin_callsign: adminCallsign,
    });
    if (data && data.ok) {
      setData((prev) => prev.filter((entry) => entry.session.id !== sessionId));
    }
  };

  const formatCombined = (reports: CqSignalReport[]): string => {
    if (reports.length === 0) return '—';
    return reports.map((r) => `${r.reporter_callsign} (${r.signal_report})`).join(', ');
  };

  const formatTime = (iso: string): string =>
    new Date(iso).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

  const buildMarkdown = (): string => {
    const dateStr = new Date().toISOString().slice(0, 10);
    const lines: string[] = [
      `# Daily Report — ${dateStr}`,
      '',
      '| Timestamp | Active Station | Band | Mode | Reporting Station | Signal Report (RST) |',
      '|-----------|----------------|------|------|-------------------|----------------------|',
    ];

    for (const { session, reports } of data) {
      const ts = formatTime(session.created_at);
      const station = session.callsign || 'N/A';
      const band = session.band || 'N/A';
      const mode = session.mode || 'N/A';

      if (reports.length === 0) {
        lines.push(`| ${ts} | ${station} | ${band} | ${mode} | None (Self-Spot) | N/A |`);
      } else {
        for (const r of reports) {
          lines.push(
            `| ${ts} | ${station} | ${band} | ${mode} | ${r.reporter_callsign || 'N/A'} | ${r.signal_report || 'N/A'} |`
          );
        }
      }
    }

    return lines.join('\n');
  };

  const downloadMarkdown = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    let y = 20;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Last 24 Hours Report', margin, y);
    y += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Callsign', margin, y);
    doc.text('Time', margin + 50, y);
    doc.text('Band / Mode', margin + 80, y);
    doc.text('Signal Report / Details', margin + 120, y);
    y += 4;
    doc.setDrawColor(200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    for (const { session, reports } of data) {
      if (y > 195) {
        doc.addPage();
        y = 20;
      }
      const time = pdfTime(session.created_at);
      const combined = sanitizeForPdf(formatCombined(reports));
      const bandStr = sanitizeForPdf(`${session.band} ${session.mode}`);

      doc.text(sanitizeForPdf(session.callsign), margin, y);
      doc.text(time, margin + 50, y);
      doc.text(bandStr, margin + 80, y);
      const splitCombined = doc.splitTextToSize(combined, pageWidth - margin - 120);
      doc.text(splitCombined, margin + 120, y);
      y += Math.max(5, splitCombined.length * 4 + 2);
    }

    doc.save(`Todays_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const exportToNotebook = async () => {
    setNotebookStatus('working');
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      const md = buildMarkdown();
      downloadMarkdown(md, `Daily_Report_${dateStr}.md`);

      try {
        await navigator.clipboard.writeText(NOTEBOOKLM_PROMPT);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = NOTEBOOKLM_PROMPT;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }

      window.open('https://notebooklm.google.com/', '_blank', 'noopener,noreferrer');
      setNotebookStatus('done');
      setTimeout(() => setNotebookStatus('idle'), 4000);
    } catch {
      setNotebookStatus('error');
      setTimeout(() => setNotebookStatus('idle'), 4000);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-start justify-center overflow-y-auto bg-slate-900/50 px-4 py-8 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl animate-fade-up rounded-3xl glass-strong p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-600 dark:text-brand-300">
              <Calendar className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold">{t('todaysReportTitle')}</h2>
          </div>
          <div className="flex items-center gap-2">
            {data.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={exportPdf}
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-600 active:scale-95"
                >
                  <FileDown className="h-4 w-4" />
                  {t('exportPdf')}
                </button>
                <button
                  type="button"
                  onClick={exportToNotebook}
                  disabled={notebookStatus === 'working'}
                  className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-violet-600/25 transition hover:bg-violet-700 active:scale-95 disabled:opacity-70"
                >
                  {notebookStatus === 'working' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <NotebookPen className="h-4 w-4" />
                  )}
                  {t('exportNotebook')}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {notebookStatus === 'done' && (
          <div className="mb-3 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {t('notebookPromptCopied')}
          </div>
        )}
        {notebookStatus === 'error' && (
          <div className="mb-3 rounded-xl bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-500">
            {t('notebookPromptError')}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
          </div>
        ) : data.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">{t('todaysReportEmpty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-white/10 dark:text-slate-400">
                  <th className="px-2 py-2 text-start">{t('colCallsign')}</th>
                  <th className="px-2 py-2 text-start">{t('colTime')}</th>
                  <th className="px-2 py-2 text-start">{t('colBand')}</th>
                  <th className="px-2 py-2 text-start">{t('colCombinedReport')}</th>
                  {isAdmin && <th className="px-2 py-2 text-center">{t('delete')}</th>}
                </tr>
              </thead>
              <tbody>
                {data.map(({ session, reports }) => {
                  const time = new Date(session.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const combined = formatCombined(reports);
                  return (
                    <tr
                      key={session.id}
                      className="border-b border-slate-100 dark:border-white/5"
                    >
                      <td className="px-2 py-2.5 font-mono font-bold">{session.callsign}</td>
                      <td className="px-2 py-2.5 text-slate-500 dark:text-slate-400">{time}</td>
                      <td className="px-2 py-2.5">{session.band} {session.mode}</td>
                      <td className="px-2 py-2.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span>{combined}</span>
                          {isAdmin && reports.length > 0 && (
                            <div className="flex shrink-0 gap-1">
                              {reports.map((r) => (
                                <button
                                  key={r.id}
                                  type="button"
                                  onClick={() => handleDeleteReport(r.id, session.id)}
                                  className="rounded-full bg-red-500/10 p-1 text-red-500 transition hover:bg-red-500/20 active:scale-95"
                                  aria-label={t('delete')}
                                  title={`${t('delete')}: ${r.reporter_callsign}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      {isAdmin && (
                        <td className="px-2 py-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteSession(session.id)}
                            className="inline-flex items-center justify-center rounded-full bg-red-500/10 p-1.5 text-red-500 transition hover:bg-red-500/20 active:scale-95"
                            aria-label={t('delete')}
                            title={t('delete')}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-200 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
        >
          {t('close')}
        </button>
      </div>
    </div>
  );
}
