import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { Net, NetParticipant, SignalReport } from '@/types';
import { sanitizeForPdf } from '@/lib/pdfSanitize';
import { formatJerusalemDateTime } from '@/lib/netTime';

export function buildSignalMatrix(
  participants: NetParticipant[],
  reports: SignalReport[]
): (string | number)[][] {
  const callsigns = participants
    .map((p) => p.callsign.toUpperCase())
    .sort((a, b) => a.localeCompare(b));
  const uniqueCallsigns = [...new Set(callsigns)];

  const reportMap = new Map<string, string>();
  for (const r of reports) {
    const key = `${r.tx_callsign.toUpperCase()}:${r.rx_callsign.toUpperCase()}`;
    reportMap.set(key, r.rst_report);
  }

  const metaMap = new Map<string, NetParticipant>();
  for (const p of participants) {
    metaMap.set(p.callsign.toUpperCase(), p);
  }

  const headerRow: (string | number)[] = [
    'TX \\ RX',
    ...uniqueCallsigns.map((cs) => {
      const meta = metaMap.get(cs);
      const parts = [cs];
      if (meta?.grid) parts.push(`(${meta.grid})`);
      if (meta?.city) parts.push(meta.city);
      if (meta?.power) parts.push(meta.power);
      if (meta?.antenna) parts.push(meta.antenna);
      return parts.join(' ');
    }),
  ];

  const rows: (string | number)[][] = [headerRow];

  for (const tx of uniqueCallsigns) {
    const meta = metaMap.get(tx);
    const rowLabelParts = [tx];
    if (meta?.grid) rowLabelParts.push(`(${meta.grid})`);
    if (meta?.city) rowLabelParts.push(meta.city);
    if (meta?.power) rowLabelParts.push(meta.power);
    if (meta?.antenna) rowLabelParts.push(meta.antenna);
    const rowLabel = rowLabelParts.join(' ');

    const row: (string | number)[] = [rowLabel];
    for (const rx of uniqueCallsigns) {
      if (tx === rx) {
        row.push('N/A');
      } else {
        const key = `${tx}:${rx}`;
        row.push(reportMap.get(key) ?? '');
      }
    }
    rows.push(row);
  }

  const metadataBlock: (string | number)[][] = [[], [], ['Participant Metadata'], ['Callsign', 'Grid', 'City', 'Power', 'Antenna']];
  for (const cs of uniqueCallsigns) {
    const meta = metaMap.get(cs);
    if (meta) {
      metadataBlock.push([cs, meta.grid, meta.city, meta.power, meta.antenna]);
    }
  }

  return [...rows, ...metadataBlock];
}

export function downloadSignalMatrix(
  net: Net,
  participants: NetParticipant[],
  reports: SignalReport[]
): boolean {
  try {
    const aoa = buildSignalMatrix(participants, reports);
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    ws['!cols'] = aoa[0].map((_, i) => ({
      wch: i === 0 ? 30 : 18,
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Signal Matrix');

    const dateStr = net.starts_at
      ? new Date(net.starts_at).toISOString().slice(0, 10)
      : net.net_date || new Date().toISOString().slice(0, 10);
    const filename = `Signal_Matrix_${dateStr}_${net.id}.xlsx`;

    XLSX.writeFile(wb, filename);
    return true;
  } catch {
    return false;
  }
}

export function downloadNetPdf(
  net: Net,
  participants: NetParticipant[],
  reports: SignalReport[]
): boolean {
  try {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    let y = 18;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const title = sanitizeForPdf(net.name) || `${sanitizeForPdf(net.frequency)} ${sanitizeForPdf(net.mode)}`;
    doc.text(
      `${title} — ${sanitizeForPdf(net.starts_at ? formatJerusalemDateTime(net.starts_at) : net.net_date)}`,
      margin,
      y
    );
    y += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`${sanitizeForPdf(net.frequency)} MHz / ${sanitizeForPdf(net.mode)}`, margin, y);
    y += 8;

    const matrix = buildSignalMatrix(participants, reports);
    const colCount = matrix[0]?.length ?? 0;
    const colWidth = Math.max(22, Math.min(60, (pageWidth - margin * 2) / Math.max(colCount, 1)));

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');

    for (let rowIdx = 0; rowIdx < matrix.length; rowIdx++) {
      const row = matrix[rowIdx];
      if (y > 195) {
        doc.addPage();
        y = 18;
      }

      if (rowIdx === 0) {
        for (let c = 0; c < row.length; c++) {
          const text = sanitizeForPdf(String(row[c]));
          const lines = doc.splitTextToSize(text, colWidth - 2);
          doc.text(lines, margin + c * colWidth, y);
        }
        y += 5;
        doc.setDrawColor(180);
        doc.line(margin, y, margin + colWidth * row.length, y);
        y += 3;
      } else if (row[0] === '' || row[0] === 'Participant Metadata') {
        if (row[0] === 'Participant Metadata') {
          y += 4;
          doc.setFontSize(9);
          doc.text('Participant Metadata', margin, y);
          y += 5;
          doc.setFontSize(7);
        }
        continue;
      } else if (row[0] === 'Callsign') {
        for (let c = 0; c < row.length; c++) {
          doc.text(sanitizeForPdf(String(row[c])), margin + c * colWidth, y);
        }
        y += 4;
        doc.setDrawColor(200);
        doc.line(margin, y, margin + colWidth * row.length, y);
        y += 3;
      } else {
        for (let c = 0; c < row.length; c++) {
          const text = sanitizeForPdf(String(row[c]));
          const lines = doc.splitTextToSize(text, colWidth - 2);
          doc.text(lines, margin + c * colWidth, y);
        }
        y += 4;
      }
    }

    const dateStr = sanitizeForPdf(
      net.starts_at ? new Date(net.starts_at).toISOString().slice(0, 10) : net.net_date
    ) || new Date().toISOString().slice(0, 10);
    doc.save(`Signal_Matrix_${dateStr}_${net.id}.pdf`);
    return true;
  } catch {
    return false;
  }
}
