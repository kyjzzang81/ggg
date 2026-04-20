import { createClient } from "npm:@supabase/supabase-js@2";
import { corsJson, corsOptions } from "../_shared/cors.ts";

type CityRow = { id: string; name_ko: string | null; lat: number | null; lon: number | null };

type NearbyRequest = {
  city_id?: string;
  force?: boolean;
  weather?: string[];
};

type NaverLocalItem = {
  title?: string;
  category?: string;
  description?: string;
  telephone?: string;
  address?: string;
  roadAddress?: string;
  mapx?: string;
  mapy?: string;
  link?: string;
};

const NAVER_LOCAL_URL = "https://openapi.naver.com/v1/search/local.json";
const DEFAULT_DISPLAY = 5;
const CACHE_TTL_MIN = 60 * 24;

function stripHtml(s: string | undefined): string {
  if (!s) return "";
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function parseCoord(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n / 10_000_000;
}

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function normalizeForId(s: string | null): string {
  if (!s) return "";
  return s.toLowerCase().replace(/\s+/g, "").replace(/[^\p{L}\p{N}]/gu, "");
}

async function stablePlaceId(input: {
  source: string;
  title: string;
  addr: string | null;
  lat: number | null;
  lon: number | null;
}): Promise<string> {
  const raw = [
    input.source,
    normalizeForId(input.title),
    normalizeForId(input.addr),
    input.lat != null ? input.lat.toFixed(5) : "",
    input.lon != null ? input.lon.toFixed(5) : "",
  ].join("|");
  const bytes = new TextEncoder().encode(raw);
  const hash = await crypto.subtle.digest("SHA-1", bytes);
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${input.source}:${hex}`;
}

function dedupeUpserts(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const byKey = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const cityId = String(row.city_id ?? "");
    const placeId = String(row.place_id ?? "");
    if (!cityId || !placeId) continue;
    const key = `${cityId}::${placeId}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, row);
      continue;
    }
    const prevTags = Array.isArray(prev.weather_tags) ? (prev.weather_tags as string[]) : [];
    const nextTags = Array.isArray(row.weather_tags) ? (row.weather_tags as string[]) : [];
    byKey.set(key, {
      ...prev,
      ...row,
      weather_tags: uniq([...prevTags, ...nextTags]),
    });
  }
  return [...byKey.values()];
}

function tagsForQuery(query: string): string[] {
  const t: string[] = [];
  if (query.includes("실내") || query.includes("카페") || query.includes("전시")) {
    t.push("indoor", "rain", "hot", "dusty");
  }
  if (query.includes("공원") || query.includes("전망") || query.includes("산책")) {
    t.push("outdoor", "clear");
  }
  if (query.includes("야경") || query.includes("야간")) t.push("night", "hot");
  return uniq(t);
}

function weatherKeywords(weather: string[] | undefined): string[] {
  const w = (weather ?? []).map((x) => x.toLowerCase());
  if (w.includes("rain")) return ["실내 관광지", "전시관", "카페", "실내 데이트"];
  if (w.includes("hot")) return ["실내 관광지", "카페", "야간 산책", "전시관"];
  if (w.includes("dusty")) return ["실내 관광지", "전시관", "복합문화공간"];
  if (w.includes("clear")) return ["공원", "전망대", "산책", "야외 명소"];
  return ["관광지", "데이트 코스", "가볼만한 곳", "카페"];
}

async function naverSearch(
  clientId: string,
  clientSecret: string,
  query: string,
): Promise<NaverLocalItem[]> {
  const qs = new URLSearchParams({
    query,
    display: String(DEFAULT_DISPLAY),
    start: "1",
    sort: "random",
  });
  const res = await fetch(`${NAVER_LOCAL_URL}?${qs.toString()}`, {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Naver local ${res.status}: ${body.slice(0, 200)}`);
  }
  const body = (await res.json()) as { items?: NaverLocalItem[] };
  return body.items ?? [];
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return corsOptions();
    if (req.method !== "POST") return corsJson({ error: "POST only" }, 405);

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const clientId =
      Deno.env.get("NAVER_SEARCH_CLIENT_ID") ??
      Deno.env.get("NAVER_CLIENT_ID") ??
      Deno.env.get("NAVER_MAP_CLIENT") ??
      "";
    const clientSecret =
      Deno.env.get("NAVER_SEARCH_CLIENT_SECRET") ??
      Deno.env.get("NAVER_CLIENT_SECRET") ??
      Deno.env.get("NAVER_MAP_CLIENT_SECRET") ??
      "";
    if (!url || !serviceKey) return corsJson({ error: "Missing Supabase env" }, 500);
    if (!clientId || !clientSecret) {
      return corsJson(
        {
          error:
            "Missing Naver credentials. Set NAVER_SEARCH_CLIENT_ID/NAVER_SEARCH_CLIENT_SECRET in Supabase secrets.",
        },
        500,
      );
    }

    let body: NearbyRequest;
    try {
      body = (await req.json()) as NearbyRequest;
    } catch {
      return corsJson({ error: "Invalid JSON" }, 400);
    }
    const cityId = String(body.city_id ?? "").trim();
    if (!cityId) return corsJson({ error: "city_id is required" }, 400);

    const supabase = createClient(url, serviceKey);
    const { data: city, error: cityErr } = await supabase
      .from("cities")
      .select("id, name_ko, lat, lon")
      .eq("id", cityId)
      .maybeSingle();
    if (cityErr || !city) {
      return corsJson({ error: cityErr?.message ?? "city not found" }, 404);
    }

    const force = Boolean(body.force);
    const { data: latest } = await supabase
      .from("nearby_places")
      .select("cached_at")
      .eq("city_id", cityId)
      .order("cached_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const latestCachedAt = latest?.cached_at ? Date.parse(latest.cached_at as string) : NaN;
    const fresh =
      Number.isFinite(latestCachedAt) &&
      Date.now() - latestCachedAt < CACHE_TTL_MIN * 60 * 1000;

    if (!force && fresh) {
      return corsJson({ ok: true, city_id: cityId, skipped: true, reason: "cache_fresh" });
    }

    const cityName = (city as CityRow).name_ko?.trim() || cityId;
    const keywords = weatherKeywords(body.weather).slice(0, 4);
    const queries = uniq(keywords.map((k) => `${cityName} ${k}`));

    const upserts: Record<string, unknown>[] = [];
    for (const query of queries) {
      let items: NaverLocalItem[] = [];
      try {
        items = await naverSearch(clientId, clientSecret, query);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return corsJson(
          {
            error: `Naver search failed for query "${query}": ${msg}`,
            city_id: cityId,
            query,
          },
          502,
        );
      }
      const tags = tagsForQuery(query);
      for (const item of items) {
        const title = stripHtml(item.title);
        if (!title) continue;
        const addr = stripHtml(item.roadAddress) || stripHtml(item.address) || null;
        const lat = parseCoord(item.mapy);
        const lon = parseCoord(item.mapx);
        const sourceLink = item.link?.slice(0, 500) ?? null;
        const placeId = await stablePlaceId({
          source: "naver_local",
          title,
          addr,
          lat,
          lon,
        });
        const category = stripHtml(item.category).slice(0, 120) || null;
        const summary = stripHtml(item.description).slice(0, 500) || null;
        upserts.push({
          city_id: cityId,
          place_id: placeId,
          source: "naver_local",
          source_link: sourceLink,
          title,
          category,
          summary,
          addr,
          lat,
          lon,
          tel: stripHtml(item.telephone) || null,
          weather_tags: tags.length ? tags : null,
          cached_at: new Date().toISOString(),
        });
      }
    }

    const deduped = dedupeUpserts(upserts);

    if (!deduped.length) {
      return corsJson({ ok: true, city_id: cityId, upserted: 0, queries, message: "no results" });
    }

    for (const row of deduped) {
      const { error: upErr } = await supabase.from("nearby_places").upsert(row, {
        onConflict: "city_id,place_id",
      });
      if (upErr) return corsJson({ error: upErr.message, city_id: cityId }, 500);
    }

    return corsJson({
      ok: true,
      city_id: cityId,
      queries,
      upserted: deduped.length,
      collected: upserts.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return corsJson({ error: `nearby-sync internal error: ${msg}` }, 500);
  }
});
