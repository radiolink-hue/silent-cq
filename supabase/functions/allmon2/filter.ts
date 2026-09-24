export interface ParsedNode {
  node: string;
  callsign: string;
  transmitting: boolean;
}

/** AllStar echo/test node — never treat as a real station. */
export const ALLSTAR_ECHO_NODE = "1999";
/** Hub Cloud Node that owns the 48552 bridge — not a real operator. */
export const ALLSTAR_HUB_NODE = "48552";

export function shouldDropAllstarNode(node: string, info: string, callsign: string): boolean {
  const nodeId = node.trim();
  if (nodeId === ALLSTAR_ECHO_NODE) return true;
  if (nodeId === ALLSTAR_HUB_NODE) return true;

  const label = `${callsign} ${info}`.replace(/\s+/g, " ").trim();
  if (/^n\/a$/i.test(callsign.trim())) return true;
  if (/\bn\/a\b/i.test(label)) return true;
  if (/not\s+in\s+database/i.test(label)) return true;
  return false;
}

function extractText(html: string, start: number, end: number): string {
  return html
    .slice(start, end)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse https://stats.allstarlink.org/nodeinfo.cgi?node=48552
 * Callsigns come only from the Callsign column. Empty/invalid cells are skipped.
 */
export function parseNodeInfoCgi(html: string): { nodes: ParsedNode[]; foundTable: boolean } {
  const nodes: ParsedNode[] = [];
  const seenNodes = new Set<string>();
  const seenCallsigns = new Set<string>();
  let foundTable = false;

  const tableRe = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch: RegExpExecArray | null;
  while ((tableMatch = tableRe.exec(html)) !== null) {
    const tableHtml = tableMatch[1];
    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch: RegExpExecArray | null;
    let nodeIdx = -1;
    let callsignIdx = -1;

    while ((rowMatch = rowRe.exec(tableHtml)) !== null) {
      const rowHtml = rowMatch[1];
      const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      const cells: string[] = [];
      let cellMatch: RegExpExecArray | null;
      while ((cellMatch = cellRe.exec(rowHtml)) !== null) {
        cells.push(extractText(rowHtml, cellMatch.index, cellMatch.index + cellMatch[0].length));
      }
      if (cells.length < 2) continue;

      if (nodeIdx < 0) {
        const headerNode = cells.findIndex((c) => /^node$/i.test(c.trim()));
        const headerCs = cells.findIndex((c) => /^callsign$/i.test(c.trim()));
        if (headerNode >= 0 && headerCs >= 0) {
          foundTable = true;
          nodeIdx = headerNode;
          callsignIdx = headerCs;
        }
        continue;
      }

      const nodeNum = (cells[nodeIdx] ?? "").replace(/[^\d]/g, "");
      const callsign = (cells[callsignIdx] ?? "").trim().split(/\s+/)[0]?.toUpperCase() ?? "";
      if (!nodeNum) continue;
      if (shouldDropAllstarNode(nodeNum, callsign, callsign)) continue;
      if (!callsign || /^n\/a$/i.test(callsign) || !/[A-Z]/.test(callsign) || !/\d/.test(callsign)) continue;
      if (seenNodes.has(nodeNum) || seenCallsigns.has(callsign)) continue;

      seenNodes.add(nodeNum);
      seenCallsigns.add(callsign);
      nodes.push({ node: nodeNum, callsign, transmitting: false });
    }
  }

  return { nodes, foundTable };
}

export function parseAllmon2(html: string): { nodes: ParsedNode[]; transmittingNode: string | null } {
  const nodes: ParsedNode[] = [];
  const seen = new Set<string>();
  let transmittingNode: string | null = null;

  const tableRe = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch: RegExpExecArray | null;
  while ((tableMatch = tableRe.exec(html)) !== null) {
    const tableHtml = tableMatch[1];
    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch: RegExpExecArray | null;
    while ((rowMatch = rowRe.exec(tableHtml)) !== null) {
      const rowHtml = rowMatch[1];
      const isGreen = /background-color:\s*green|bgcolor=["']?green|class=["']?[^"']*table-success/i.test(rowHtml);
      const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      const cells: string[] = [];
      let cellMatch: RegExpExecArray | null;
      while ((cellMatch = cellRe.exec(rowHtml)) !== null) {
        cells.push(extractText(rowHtml, cellMatch.index, cellMatch.index + cellMatch[0].length));
      }
      if (cells.length < 2) continue;

      const nodeNum = cells[0].trim();
      const info = cells[1].trim();
      if (!nodeNum || !/^\d+$/.test(nodeNum)) continue;
      if (seen.has(nodeNum)) continue;

      const callsign = info.split(/\s+/)[0] || nodeNum;
      if (shouldDropAllstarNode(nodeNum, info, callsign)) continue;

      seen.add(nodeNum);
      const node: ParsedNode = { node: nodeNum, callsign, transmitting: isGreen };
      nodes.push(node);

      if (isGreen && !transmittingNode) {
        transmittingNode = nodeNum;
      }
    }
  }

  return { nodes, transmittingNode };
}
