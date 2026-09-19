import { latLngToGrid } from "../../../src/lib/maidenhead.ts";

export const ALLSTAR_GPS_SOURCE = "allstar-gps";

export interface AllstarGps {
  node: string;
  callsign: string;
  lat: number;
  lng: number;
  city: string;
  country: string;
  gridsquare: string;
  location: string;
  source: typeof ALLSTAR_GPS_SOURCE;
}

function parseCoord(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  if (!Number.isFinite(n)) return null;
  return n;
}

function splitLocation(location: string): { city: string; country: string } {
  const parts = location
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    return { city: parts[0], country: parts.slice(1).join(", ") };
  }
  return { city: parts[0] ?? "", country: "" };
}

export function gpsFromLatLng(
  node: string,
  callsign: string,
  lat: number,
  lng: number,
  location = "",
): AllstarGps | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  const loc = location.trim();
  const { city, country } = splitLocation(loc);
  return {
    node: String(node).trim(),
    callsign: callsign.trim().toUpperCase(),
    lat,
    lng,
    city,
    country,
    gridsquare: latLngToGrid(lat, lng),
    location: loc,
    source: ALLSTAR_GPS_SOURCE,
  };
}

function gpsFromServer(
  node: unknown,
  callsign: unknown,
  server: unknown,
): AllstarGps | null {
  if (!server || typeof server !== "object") return null;
  const rec = server as Record<string, unknown>;
  const lat = parseCoord(rec.Latitude ?? rec.latitude);
  const lng = parseCoord(rec.Logitude ?? rec.Longitude ?? rec.longitude);
  if (lat == null || lng == null) return null;
  const location = String(rec.Location ?? rec.location ?? rec.SiteName ?? "");
  const nodeId = String(node ?? "").trim();
  const cs = String(callsign ?? rec.User_ID ?? "").trim();
  if (!nodeId) return null;
  return gpsFromLatLng(nodeId, cs, lat, lng, location);
}

function collectNodeRecord(target: Map<string, AllstarGps>, rec: unknown): void {
  if (!rec || typeof rec !== "object") return;
  const obj = rec as Record<string, unknown>;
  const node = obj.name ?? obj.node ?? obj.Node_ID;
  const callsign = obj.callsign ?? obj.User_ID;
  const gps = gpsFromServer(node, callsign, obj.server);
  if (!gps) return;
  target.set(gps.node, gps);
}

/**
 * GPS for the hub and its linked stations. This is the same dataset
 * rendered as the AllStar bubble map (networkMap is a JPEG of that data).
 */
export function parseAllstarStatsGps(payload: unknown): Map<string, AllstarGps> {
  const byNode = new Map<string, AllstarGps>();
  if (!payload || typeof payload !== "object") return byNode;

  const root = payload as Record<string, unknown>;
  const stats = (root.stats && typeof root.stats === "object" ? root.stats : root) as Record<
    string,
    unknown
  >;
  const data = (stats.data && typeof stats.data === "object" ? stats.data : {}) as Record<
    string,
    unknown
  >;

  collectNodeRecord(byNode, stats.user_node);
  collectNodeRecord(byNode, root.node);
  collectNodeRecord(byNode, stats.node);

  const linked = data.linkedNodes;
  if (Array.isArray(linked)) {
    for (const item of linked) collectNodeRecord(byNode, item);
  }

  return byNode;
}

/** Tab-delimited AllStar mapData: node, callsign, lat, lng, location, … */
export function parseAllstarMapData(text: string): Map<string, AllstarGps> {
  const byNode = new Map<string, AllstarGps>();
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith("#")) continue;
    const cols = line.split("\t");
    if (cols.length < 4) continue;
    const lat = parseCoord(cols[2]);
    const lng = parseCoord(cols[3]);
    if (lat == null || lng == null) continue;
    const gps = gpsFromLatLng(cols[0], cols[1], lat, lng, cols[4] ?? "");
    if (gps) byNode.set(gps.node, gps);
  }
  return byNode;
}

export function mergeAllstarGps(
  primary: Map<string, AllstarGps>,
  fallback: Map<string, AllstarGps>,
): Map<string, AllstarGps> {
  const merged = new Map(fallback);
  for (const [node, gps] of primary) merged.set(node, gps);
  return merged;
}
