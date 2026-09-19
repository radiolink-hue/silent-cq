import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { parseAllmon2, shouldDropAllstarNode, type ParsedNode } from "./filter.ts";
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

const ALLMON_URL = "http://140.82.58.13/allmon2/link.php?nodes=48552";
const NODE_ID = "48552";
const SOURCE_TAG = `allmon2_${NODE_ID}`;
const COMMENT_TAG = "Auto-ingested from Allmon2 Node 48552";
const BAND = "Allstar / VoIPC";
const MODE = "FM / Digital Node";
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

const MOCK_NODES: ParsedNode[] = [
  { node: "429730", callsign: "4X1DA", transmitting: true },
  { node: "48400", callsign: "4Z4DX", transmitting: false },
  { node: "48301", callsign: "4X1ABC", transmitting: false },
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // If a callsign query param is present, handle geocache lookup
    const url = new URL(req.url);
    if (url.searchParams.has("callsign")) {
      return await handleCallsignLookup(req, supabase);
    }

    // Check if we're in the Thursday Allstar net window
    const inWindow = isAllstarNetActive();

    if (!inWindow) {
      // Outside ingestion window — deactivate stale allstar sessions and return idle
      await supabase
        .from("cq_sessions")
        .update({ active: false })
        .neq("allstar_source", "")
        .not("allstar_source", "is", null)
        .eq("active", true);

      return new Response(
        JSON.stringify({
          status: "idle",
          node: NODE_ID,
          nodes: [],
          transmittingNode: null,
          error: null,
          upserted: 0,
          message: "Outside Allstar net ingestion window (Thursday 19:25–20:30 IST)",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let html = "";
    let live = false;
    let fetchError: string | null = null;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const resp = await fetch(ALLMON_URL, {
        signal: controller.signal,
        headers: { "User-Agent": USER_AGENT },
      });
      clearTimeout(timeout);
      if (resp.ok) {
        html = await resp.text();
        live = true;
      } else {
        fetchError = `HTTP ${resp.status}`;
      }
    } catch (e) {
      fetchError = e instanceof Error ? e.message : "fetch failed";
    }

    let parsed: { nodes: ParsedNode[]; transmittingNode: string | null };

    if (live && html) {
      parsed = parseAllmon2(html);
      if (parsed.nodes.length === 0) {
        parsed = { nodes: MOCK_NODES, transmittingNode: "429730" };
        live = false;
      }
    } else {
      parsed = { nodes: MOCK_NODES, transmittingNode: "429730" };
      live = false;
    }

    const gpsByNode = await fetchAllstarGpsByNode(parsed.nodes.map((n) => n.node));

    const { data: existing } = await supabase
      .from("cq_sessions")
      .select("id, callsign, allstar_source")
      .eq("active", true)
      .not("allstar_source", "is", null)
      .neq("allstar_source", "");

    const existingNodes = new Map<string, string>();
    for (const row of (existing ?? []) as { id: string; callsign: string; allstar_source: string }[]) {
      existingNodes.set(row.allstar_source, row.id);
    }

    const staleSources = new Set(existingNodes.keys());
    const upserts: {
      callsign: string;
      band: string;
      mode: string;
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

      const sourceKey = `${SOURCE_TAG}:${node.node}`;
      staleSources.delete(sourceKey);

      const sessionId = existingNodes.get(sourceKey);
      if (sessionId) {
        const gps = gpsByNode.get(node.node);
        if (gps) {
          const geo = gpsToGeo(gps);
          await upsertGeocache(supabase, node.callsign, geo);
          await supabase
            .from("cq_sessions")
            .update({
              gridsquare: geo.gridsquare,
              lat: geo.lat,
              lng: geo.lng,
              city: geo.city || undefined,
              country: geo.country || undefined,
            })
            .eq("id", sessionId);
        }
        continue;
      }

      const geo = await resolveNodeGeo(supabase, node, gpsByNode);

      upserts.push({
        callsign: node.callsign,
        band: BAND,
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
    }

    if (upserts.length > 0) {
      await supabase.from("cq_sessions").insert(upserts);
    }

    for (const staleKey of staleSources) {
      const sessionId = existingNodes.get(staleKey);
      if (sessionId) {
        await supabase.from("cq_sessions").update({ active: false }).eq("id", sessionId);
      }
    }

    if (parsed.transmittingNode) {
      const txSourceKey = `${SOURCE_TAG}:${parsed.transmittingNode}`;
      const existingArr = (existing ?? []) as { id: string; callsign: string; allstar_source: string }[];
      const txRow = existingArr.find((r) => r.allstar_source === txSourceKey);

      if (txRow) {
        await supabase
          .from("cq_sessions")
          .update({ created_at: new Date().toISOString() })
          .eq("id", txRow.id);
      } else {
        const txNode = parsed.nodes.find((n) => n.node === parsed.transmittingNode);
        if (txNode && !shouldDropAllstarNode(txNode.node, txNode.callsign, txNode.callsign)) {
          const { data: checkRow } = await supabase
            .from("cq_sessions")
            .select("id")
            .eq("active", true)
            .eq("allstar_source", txSourceKey)
            .maybeSingle();
          if (!checkRow) {
            const geo = await resolveNodeGeo(supabase, txNode, gpsByNode);
            await supabase.from("cq_sessions").insert({
              callsign: txNode.callsign,
              band: BAND,
              mode: MODE,
              comments: COMMENT_TAG,
              allstar_source: txSourceKey,
              active: true,
              gridsquare: geo?.gridsquare ?? "",
              lat: geo?.lat ?? null,
              lng: geo?.lng ?? null,
              city: geo?.city ?? "",
              country: geo?.country ?? "",
            });
          } else {
            await supabase
              .from("cq_sessions")
              .update({ created_at: new Date().toISOString() })
              .eq("id", (checkRow as { id: string }).id);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        status: live ? "live" : "fallback",
        node: NODE_ID,
        nodes: parsed.nodes,
        transmittingNode: parsed.transmittingNode,
        error: fetchError,
        upserted: upserts.length,
        gpsNodes: gpsByNode.size,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        status: "error",
        node: NODE_ID,
        nodes: MOCK_NODES,
        transmittingNode: "48552",
        error: err instanceof Error ? err.message : "unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
