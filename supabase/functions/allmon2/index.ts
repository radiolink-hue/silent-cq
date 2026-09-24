import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { parseNodeInfoCgi, shouldDropAllstarNode, type ParsedNode } from "./filter.ts";
import {
  ALLSTAR_GPS_SOURCE,
  mergeAllstarGps,
  parseAllstarMapData,
  parseAllstarStatsGps,
  type AllstarGps,
} from "./gps.ts";
import { getActiveNet } from "../../../src/lib/nets.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const NODE_ID = "48552";
const SOURCE_TAG = `allmon2_${NODE_ID}`;
const NODEINFO_URL = `https://stats.allstarlink.org/nodeinfo.cgi?node=${NODE_ID}`;
const COMMENT_TAG = "Auto-ingested from Allmon2 Node 48552";
const BAND = "70cm";
const FREQUENCY = "430.9";
const MODE = "FM";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const USER_AGENT = "SilentCQ-Monitor/1.0";
/** JSON behind nodeinfo.cgi / the networkMap bubble image (JPEG). */
const NODE_STATS_URL = `https://stats.allstarlink.org/api/stats/${NODE_ID}`;
const MAPDATA_URL = "https://stats.allstarlink.org/api/stats/mapData";
const MAPDATA_TTL_MS = 90 * 1000;

let mapDataCache: { at: number; byNode: Map<string, AllstarGps> } | null = null;

interface GeoResult {
  gridsquare: string;
  lat: number;
  lng: number;
  city: string;
  country: string;
  source: string;
}

// Server UTC clock is master truth. Convert to Asia/Jerusalem only for the schedule window.
function isAllstarNetActive(utcNow: Date = new Date()): boolean {
  return getActiveNet(utcNow)?.id === "allstar";
}

// --- Maidenhead conversion (lat/lng -> 6-char grid) ---
function latLngToGrid(lat: number, lng: number): string {
  const adjLng = lng + 180;
  const adjLat = lat + 90;
  const field1 = String.fromCharCode(65 + Math.floor(adjLng / 20));
  const field2 = String.fromCharCode(65 + Math.floor(adjLat / 10));
  const square1 = Math.floor((adjLng % 20) / 2);
  const square2 = Math.floor(adjLat % 10);
  const sub1 = String.fromCharCode(97 + Math.floor(((adjLng % 2) / 2) * 24));
  const sub2 = String.fromCharCode(97 + Math.floor((adjLat % 1) * 24));
  return `${field1}${field2}${square1}${square2}${sub1}${sub2}`;
}

// --- QRZ.com XML API lookup ---
// QRZ credentials are not configured — this function returns null gracefully.
// Callsign geocoding falls back to the Nominatim path and the callsign_geocache table.
async function lookupQRZ(_callsign: string): Promise<Partial<GeoResult> | null> {
  return null;
}

// --- OpenStreetMap Nominatim geocoding ---
async function lookupNominatim(query: string): Promise<{ gridsquare: string; lat: number; lng: number } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      {
        signal: controller.signal,
        headers: { "User-Agent": USER_AGENT },
      },
    );
    clearTimeout(timeout);
    if (!resp.ok) return null;
    const data = await resp.json() as { lat: string; lon: string }[];
    if (!data || data.length === 0) return null;
    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    if (isNaN(lat) || isNaN(lng)) return null;
    return { gridsquare: latLngToGrid(lat, lng), lat, lng };
  } catch {
    return null;
  }
}

// --- Main geocoding pipeline with 24h cache ---
async function geocodeCallsign(
  supabase: ReturnType<typeof createClient>,
  callsign: string,
): Promise<GeoResult | null> {
  const upperCallsign = callsign.toUpperCase();

  // Check cache
  const { data: cached } = await supabase
    .from("callsign_geocache")
    .select("*")
    .eq("callsign", upperCallsign)
    .maybeSingle();

  const cachedRow = cached as { gridsquare: string; lat: number; lng: number; city: string; country: string; source: string; updated_at: string } | null;

  if (cachedRow && cachedRow.gridsquare) {
    const age = Date.now() - new Date(cachedRow.updated_at).getTime();
    if (age < CACHE_TTL_MS || cachedRow.source === ALLSTAR_GPS_SOURCE) {
      return {
        gridsquare: cachedRow.gridsquare,
        lat: cachedRow.lat,
        lng: cachedRow.lng,
        city: cachedRow.city,
        country: cachedRow.country,
        source: cachedRow.source,
      };
    }
  }

  // Try QRZ first
  let result: GeoResult | null = null;
  const qrzResult = await lookupQRZ(upperCallsign);
  if (qrzResult && qrzResult.gridsquare) {
    result = {
      gridsquare: qrzResult.gridsquare,
      lat: qrzResult.lat ?? 0,
      lng: qrzResult.lng ?? 0,
      city: qrzResult.city ?? "",
      country: qrzResult.country ?? "",
      source: qrzResult.source ?? "qrz",
    };
  }

  // If QRZ didn't yield a grid, try Nominatim with the callsign as a query
  if (!result) {
    const nomResult = await lookupNominatim(upperCallsign);
    if (nomResult) {
      result = {
        gridsquare: nomResult.gridsquare,
        lat: nomResult.lat,
        lng: nomResult.lng,
        city: "",
        country: "",
        source: "nominatim",
      };
    }
  }

  if (!result) return null;

  await upsertGeocache(supabase, upperCallsign, result);
  return result;
}

async function upsertGeocache(
  supabase: ReturnType<typeof createClient>,
  callsign: string,
  geo: GeoResult,
): Promise<void> {
  await supabase.from("callsign_geocache").upsert(
    {
      callsign: callsign.toUpperCase(),
      gridsquare: geo.gridsquare,
      lat: geo.lat,
      lng: geo.lng,
      city: geo.city,
      country: geo.country,
      source: geo.source,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "callsign" },
  );
}

function gpsToGeo(gps: AllstarGps): GeoResult {
  return {
    gridsquare: gps.gridsquare,
    lat: gps.lat,
    lng: gps.lng,
    city: gps.city,
    country: gps.country,
    source: gps.source,
  };
}

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    clearTimeout(timeout);
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT },
    });
    clearTimeout(timeout);
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  }
}

async function fetchMapDataGps(): Promise<Map<string, AllstarGps>> {
  if (mapDataCache && Date.now() - mapDataCache.at < MAPDATA_TTL_MS) {
    return mapDataCache.byNode;
  }
  const text = await fetchText(MAPDATA_URL);
  const byNode = text ? parseAllstarMapData(text) : (mapDataCache?.byNode ?? new Map());
  if (text) mapDataCache = { at: Date.now(), byNode };
  return byNode;
}

/** Precise GPS from AllStar stats/networkMap; empty map if both feeds fail. */
async function fetchAllstarGpsByNode(neededNodes: string[]): Promise<Map<string, AllstarGps>> {
  const statsPayload = await fetchJson(NODE_STATS_URL);
  const fromStats = parseAllstarStatsGps(statsPayload);
  const missing = neededNodes.filter((n) => n && !fromStats.has(n));
  if (missing.length === 0) return fromStats;
  const mapData = await fetchMapDataGps();
  return mergeAllstarGps(fromStats, mapData);
}

async function resolveNodeGeo(
  supabase: ReturnType<typeof createClient>,
  node: ParsedNode,
  gpsByNode: Map<string, AllstarGps>,
): Promise<GeoResult | null> {
  const gps = gpsByNode.get(node.node);
  if (gps) {
    const geo = gpsToGeo(gps);
    await upsertGeocache(supabase, node.callsign, geo);
    return geo;
  }
  return geocodeCallsign(supabase, node.callsign);
}

// --- Handle callsign geocache lookup for the CallsignModal ---
async function handleCallsignLookup(
  req: Request,
  supabase: ReturnType<typeof createClient>,
): Promise<Response> {
  const url = new URL(req.url);
  const callsign = url.searchParams.get("callsign");
  if (!callsign) {
    return new Response(JSON.stringify({ error: "missing callsign" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const upper = callsign.toUpperCase();
  const { data: cached } = await supabase
    .from("callsign_geocache")
    .select("*")
    .eq("callsign", upper)
    .maybeSingle();

  if (cached) {
    return new Response(JSON.stringify({ geocache: cached }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Try to resolve on-demand
  const geo = await geocodeCallsign(supabase, upper);
  if (geo) {
    return new Response(JSON.stringify({ geocache: { callsign: upper, ...geo } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ geocache: null }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function emptyIngestResponse(status: "error" | "idle", message: string, extra: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({
      status,
      node: NODE_ID,
      nodes: [],
      transmittingNode: null,
      error: status === "error" ? message : null,
      upserted: 0,
      message,
      ...extra,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);
    if (url.searchParams.has("callsign")) {
      return await handleCallsignLookup(req, supabase);
    }

    const inWindow = isAllstarNetActive();

    if (!inWindow) {
      await supabase
        .from("cq_sessions")
        .update({ active: false })
        .neq("allstar_source", "")
        .not("allstar_source", "is", null)
        .eq("active", true);

      return emptyIngestResponse(
        "idle",
        "Outside Allstar net ingestion window (Thursday 19:25–20:30 IST)",
      );
    }

    let html = "";
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const resp = await fetch(NODEINFO_URL, {
        signal: controller.signal,
        headers: { "User-Agent": USER_AGENT },
      });
      clearTimeout(timeout);
      if (!resp.ok) {
        console.error(`AllStar nodeinfo fetch failed: HTTP ${resp.status}`);
        return emptyIngestResponse("error", `HTTP ${resp.status}`);
      }
      html = await resp.text();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "fetch failed";
      console.error("AllStar nodeinfo fetch failed:", msg);
      return emptyIngestResponse("error", msg);
    }

    const parsed = parseNodeInfoCgi(html);
    if (!parsed.foundTable) {
      console.error("AllStar nodeinfo: unexpected page, no Node/Callsign table");
      return emptyIngestResponse("error", "unexpected nodeinfo page");
    }

    const gpsByNode = await fetchAllstarGpsByNode(parsed.nodes.map((n) => n.node));

    const { data: existing } = await supabase
      .from("cq_sessions")
      .select("id, callsign, allstar_source")
      .eq("active", true);

    const existingRows = (existing ?? []) as { id: string; callsign: string; allstar_source: string | null }[];
    const activeByCallsign = new Map<string, { id: string; callsign: string; allstar_source: string | null }>();
    for (const row of existingRows) {
      const key = row.callsign.trim().toUpperCase();
      if (!key) continue;
      const prev = activeByCallsign.get(key);
      if (!prev) {
        activeByCallsign.set(key, row);
        continue;
      }
      const prevIsAllstar = Boolean(prev.allstar_source);
      const rowIsAllstar = Boolean(row.allstar_source);
      if (prevIsAllstar && !rowIsAllstar) {
        await supabase.from("cq_sessions").update({ active: false }).eq("id", prev.id);
        activeByCallsign.set(key, row);
      } else if (prevIsAllstar && rowIsAllstar && prev.id !== row.id) {
        await supabase.from("cq_sessions").update({ active: false }).eq("id", row.id);
      }
    }

    const liveCallsigns = new Set(parsed.nodes.map((n) => n.callsign.trim().toUpperCase()));

    const upserts: {
      callsign: string;
      band: string;
      mode: string;
      frequency: string;
      comments: string;
      allstar_source: string;
      active: boolean;
      gridsquare?: string;
      lat?: number | null;
      lng?: number | null;
      city?: string;
      country?: string;
    }[] = [];

    for (const node of parsed.nodes) {
      if (shouldDropAllstarNode(node.node, node.callsign, node.callsign)) continue;
      const cs = node.callsign.trim().toUpperCase();
      if (!cs) continue;
      if (activeByCallsign.has(cs)) continue;

      const sourceKey = `${SOURCE_TAG}:${node.node}`;
      const geo = await resolveNodeGeo(supabase, node, gpsByNode);
      upserts.push({
        callsign: cs,
        band: BAND,
        frequency: FREQUENCY,
        mode: MODE,
        comments: COMMENT_TAG,
        allstar_source: sourceKey,
        active: true,
        gridsquare: geo?.gridsquare ?? "",
        lat: geo?.lat ?? null,
        lng: geo?.lng ?? null,
        city: geo?.city ?? "",
        country: geo?.country ?? "",
      });
      activeByCallsign.set(cs, { id: "", callsign: cs, allstar_source: sourceKey });
    }

    if (upserts.length > 0) {
      const { error: insertErr } = await supabase.from("cq_sessions").insert(upserts);
      if (insertErr) {
        console.error("AllStar ingest insert failed:", insertErr.message);
      }
    }

    for (const row of existingRows) {
      if (!row.allstar_source) continue;
      const key = row.callsign.trim().toUpperCase();
      if (!liveCallsigns.has(key)) {
        await supabase.from("cq_sessions").update({ active: false }).eq("id", row.id);
      }
    }

    return new Response(
      JSON.stringify({
        status: "live",
        node: NODE_ID,
        nodes: parsed.nodes,
        transmittingNode: null,
        error: null,
        upserted: upserts.length,
        gpsNodes: gpsByNode.size,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error("AllStar ingest error:", msg);
    return new Response(
      JSON.stringify({
        status: "error",
        node: NODE_ID,
        nodes: [],
        transmittingNode: null,
        error: msg,
        upserted: 0,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
