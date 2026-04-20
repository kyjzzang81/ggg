import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CityPicker } from "../components/CityPicker";
import { PageStatus } from "../components/PageStatus";
import { CircleHelp } from "lucide-react";
import { useCities } from "../hooks/useCities";
import { useSidebar } from "../layouts/SidebarContext";
import { syncNearbyPlaces } from "../lib/nearbySync";
import { supabase } from "../lib/supabaseClient";
import { fetchWeatherCache } from "../lib/weatherCache";
import { useModeStore } from "../stores/modeStore";
import { PAGE_STATUS_COPY } from "../ui/pageStatus";
import "./pages.css";

const PIONEER_HINT_KM = 25;

type ForecastRow = {
  timestamp: string;
  temperature: number | null;
  weather_code: number | null;
  precipitation: number | null;
  wind_speed?: number | null;
  humidity?: number | null;
};

type FreqRow = {
  day_of_year: number;
  clear_days: number;
  rain_days: number;
  snow_days: number;
  total_years: number;
  period_start: string;
  period_end: string;
};

type PlaceRow = {
  category?: string | null;
  summary?: string | null;
  title: string;
  addr: string | null;
  lat?: number | null;
  lon?: number | null;
  weather_tags?: string[] | null;
  mode_tags?: string[] | null;
};

type HomeCardRow = {
  id: number;
  title: string;
  subtitle: string | null;
  nights_label: string | null;
  date_label: string | null;
  image_url: string | null;
  card_type: string | null;
  date_from: string | null;
  date_to: string | null;
  sort_order: number | null;
  mode_tags?: string[] | null;
};

type DailySummary = {
  key: string;
  label: string;
  min: number | null;
  max: number | null;
  feels: number | null;
  code: number | null;
  rainChance: number | null;
  windAvg: number | null;
  humidityAvg: number | null;
  precipSum: number | null;
};

type DailyValueMap = Record<string, number | null>;

function dayOfYear(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const y = new Date(Date.UTC(d.getFullYear(), 0, 0));
  return Math.floor((t.getTime() - y.getTime()) / 86400000);
}

function toShortDay(isoDate: string) {
  const d = new Date(`${isoDate}T00:00:00`);
  return d.toLocaleDateString("ko-KR", { weekday: "short" });
}

function formatDateKeyInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function pickDailyValue(
  valuesByDay: DailyValueMap,
  todayKey: string,
  orderedKeys: string[],
): number | null {
  const todayValue = valuesByDay[todayKey];
  if (todayValue != null) return todayValue;
  for (const key of orderedKeys) {
    const v = valuesByDay[key];
    if (v != null) return v;
  }
  return null;
}

function weatherIcon(code: number | null): string {
  if (code == null) return "/assets/weather/Cloud.png";
  if (code === 0) return "/assets/weather/Sun.png";
  if ([1, 2].includes(code)) return "/assets/weather/Cloudy-day.png";
  if (code === 3) return "/assets/weather/Cloud.png";
  if ([45, 48].includes(code)) return "/assets/weather/Cloud.png";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 80, 81, 82].includes(code))
    return "/assets/weather/Raining.png";
  if ([71, 73, 75, 77].includes(code)) return "/assets/weather/Snow.png";
  if ([95, 96, 99].includes(code)) return "/assets/weather/Thunder.png";
  return "/assets/weather/Wind.png";
}

function weatherLabel(code: number | null) {
  if (code == null) return "날씨 정보 준비 중";
  if (code === 0) return "맑음";
  if ([1, 2, 3].includes(code)) return "구름 조금";
  if ([45, 48].includes(code)) return "안개";
  if ([51, 53, 55, 56, 57, 61, 63, 65].includes(code)) return "비";
  if ([71, 73, 75, 77].includes(code)) return "눈";
  if ([80, 81, 82].includes(code)) return "소나기";
  if ([95, 96, 99].includes(code)) return "뇌우";
  return "변동성 있음";
}

function summarizeDaily(rows: ForecastRow[]): DailySummary[] {
  const map = new Map<string, ForecastRow[]>();
  for (const row of rows) {
    const key = row.timestamp.slice(0, 10);
    const arr = map.get(key) ?? [];
    arr.push(row);
    map.set(key, arr);
  }
  const today = new Date().toISOString().slice(0, 10);
  const sorted = [...map.keys()].sort((a, b) => a.localeCompare(b)).slice(0, 6);
  return sorted.map((key) => {
    const items = map.get(key) ?? [];
    const temps = items
      .map((i) => i.temperature)
      .filter((v): v is number => v != null);
    const codes = items
      .map((i) => i.weather_code)
      .filter((v): v is number => v != null);
    const code = codes.length
      ? codes.sort(
          (a, b) =>
            codes.filter((v) => v === b).length -
            codes.filter((v) => v === a).length,
        )[0]
      : null;
    const rainy = items.filter((r) => (r.precipitation ?? 0) > 0.2).length;
    const rainChance = items.length
      ? Math.round((rainy / items.length) * 100)
      : null;
    const winds = items
      .map((i) => i.wind_speed)
      .filter((v): v is number => v != null);
    const windAvg = winds.length
      ? winds.reduce((a, b) => a + b, 0) / winds.length
      : null;
    const hums = items
      .map((i) => i.humidity)
      .filter((v): v is number => v != null);
    const humidityAvg = hums.length
      ? hums.reduce((a, b) => a + b, 0) / hums.length
      : null;
    const precipSum = items.reduce((s, r) => s + (r.precipitation ?? 0), 0);
    return {
      key,
      label: key === today ? "오늘" : toShortDay(key),
      min: temps.length ? Math.min(...temps) : null,
      max: temps.length ? Math.max(...temps) : null,
      feels: temps.length
        ? temps.reduce((a, b) => a + b, 0) / temps.length
        : null,
      code,
      rainChance,
      windAvg: windAvg != null ? Math.round(windAvg * 10) / 10 : null,
      humidityAvg: humidityAvg != null ? Math.round(humidityAvg) : null,
      precipSum: precipSum > 0 ? Math.round(precipSum * 10) / 10 : 0,
    };
  });
}

function gradeFromInputs(
  code: number | null,
  rain: number | null,
  pm25: number | null,
  uv: number | null,
) {
  let score = 72;
  if (code != null) {
    if ([0, 1, 2].includes(code)) score += 12;
    else if ([61, 63, 65, 80, 81, 82].includes(code)) score -= 10;
    else if ([95, 96, 99].includes(code)) score -= 16;
  }
  if (rain != null) score -= Math.min(15, rain / 7);
  if (pm25 != null) score -= Math.min(12, pm25 / 5);
  if (uv != null && uv >= 7) score -= Math.min(8, (uv - 6) * 1.5);
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  if (clamped >= 80) return { key: "gorgeous", label: "강력 추천" as const };
  if (clamped >= 60) return { key: "great", label: "추천" as const };
  if (clamped >= 40) return { key: "good", label: "보통" as const };
  return { key: "meh", label: "비추천" as const };
}

function clothingSuggestions(
  temp: number | null,
  code: number | null,
  pm25: number | null,
): string[] {
  if (temp == null) return [];
  const items: string[] = [];
  if (temp < -5) items.push("🧥 두꺼운 롱패딩", "🧣 목도리", "🧤 장갑");
  else if (temp < 0) items.push("🧥 두꺼운 롱패딩", "🧣 목도리");
  else if (temp < 5) items.push("🧥 패딩", "🧶 니트");
  else if (temp < 10) items.push("🧥 코트", "🧶 니트");
  else if (temp < 15) items.push("🧥 가벼운 재킷", "👕 긴팔");
  else if (temp < 20) items.push("👕 긴팔", "🧥 얇은 겉옷");
  else if (temp < 25) items.push("👕 반팔");
  else items.push("👕 반팔", "🕶️ 선글라스");
  if (
    code != null &&
    [51, 53, 55, 56, 57, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(code)
  )
    items.push("☂️ 우산");
  if (pm25 != null && pm25 >= 35) items.push("😷 마스크");
  return items;
}

function rainChance(rows: ForecastRow[]) {
  if (!rows.length) return null;
  const rainy = rows.filter((r) => (r.precipitation ?? 0) > 0.2).length;
  return Math.round((rainy / rows.length) * 100);
}

function avgTemperature(rows: ForecastRow[]) {
  const nums = rows
    .map((r) => r.temperature)
    .filter((v): v is number => v != null);
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function nearestCity(
  lat: number,
  lon: number,
  list: {
    id: string;
    name_ko: string;
    lat: number | null;
    lon: number | null;
  }[],
) {
  if (!list.length) return null;
  let bestId = list[0].id,
    bestName = list[0].name_ko,
    best = Infinity;
  for (const c of list) {
    const la = c.lat,
      lo = c.lon;
    if (la == null || lo == null || Number.isNaN(la) || Number.isNaN(lo))
      continue;
    const d = haversineKm(lat, lon, la, lo);
    if (d < best) {
      best = d;
      bestId = c.id;
      bestName = c.name_ko;
    }
  }
  return { id: bestId, name: bestName, km: best };
}

async function reverseLabelKo(
  lat: number,
  lon: number,
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ko`,
      { headers: { "Accept-Language": "ko" } },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as {
      address?: Record<string, string | undefined>;
    };
    const a = body.address ?? {};
    const level1 =
      a.city ?? a.town ?? a.village ?? a.state_district ?? a.county;
    const level2 = a.suburb ?? a.city_district ?? a.neighbourhood;
    const parts = [level1, level2].filter(Boolean);
    return parts.length ? parts.join(" ") : null;
  } catch {
    return null;
  }
}

function matchesModeTags(
  tags: string[] | null | undefined,
  couple: boolean,
  family: boolean,
) {
  const active: string[] = [];
  if (couple) active.push("couple");
  if (family) active.push("family");
  if (!active.length) return true;
  if (!tags || tags.length === 0) return true;
  return tags.some((t) => active.includes(t));
}

function pickModeAwareRows<T extends { mode_tags?: string[] | null }>(
  rows: T[],
  couple: boolean,
  family: boolean,
  limit: number,
) {
  const active = couple || family;
  if (!active) return rows.slice(0, limit);
  const tagged = rows.filter(
    (r) =>
      (r.mode_tags?.length ?? 0) > 0 &&
      matchesModeTags(r.mode_tags, couple, family),
  );
  if (tagged.length) return tagged.slice(0, limit);
  return rows
    .filter((r) => !r.mode_tags || r.mode_tags.length === 0)
    .slice(0, limit);
}

function deriveNearbyWeatherHints(input: {
  rainChance: number | null;
  avgTemp: number | null;
  pm25: number | null;
  uv: number | null;
  code: number | null;
}): string[] {
  const hints: string[] = [];
  const rainyCode = [61, 63, 65, 80, 81, 82, 95, 96, 99];
  if (
    (input.rainChance ?? 0) >= 40 ||
    (input.code != null && rainyCode.includes(input.code))
  ) {
    hints.push("rain");
  }
  if ((input.avgTemp ?? 0) >= 28 || (input.uv ?? 0) >= 8) hints.push("hot");
  if ((input.pm25 ?? 0) >= 35) hints.push("dusty");
  if (!hints.length && input.code != null && [0, 1, 2].includes(input.code))
    hints.push("clear");
  return hints;
}

function scoreWeatherTag(
  tags: string[] | null | undefined,
  hints: string[],
): number {
  if (!hints.length) return 0;
  if (!tags || !tags.length) return 0;
  const set = new Set(tags.map((t) => t.toLowerCase()));
  return hints.reduce((acc, hint) => (set.has(hint) ? acc + 1 : acc), 0);
}

function formatDistance(km: number): string {
  if (!Number.isFinite(km)) return "거리 정보 준비 중";
  if (km < 1) return `현재 위치에서 약 ${Math.round(km * 1000)}m`;
  return `현재 위치에서 약 ${km.toFixed(1)}km`;
}

function naverMapWebUrl(place: PlaceRow): string {
  if (place.addr) {
    return `https://map.naver.com/v5/search/${encodeURIComponent(place.addr)}`;
  }
  return `https://map.naver.com/v5/search/${encodeURIComponent(place.title)}`;
}

function naverMapAppUrl(place: PlaceRow): string {
  const query = place.addr || place.title;
  return `nmap://search?query=${encodeURIComponent(query)}`;
}

type MetricValueTone = "default" | "primary" | "negative";

function metricValueTone(key: string, value: number | null): MetricValueTone {
  if (value == null) return "default";
  switch (key) {
    case "feels":
      if (value < 0) return "primary";
      if (value >= 30) return "negative";
      return "default";
    case "rain":
      return value >= 60 ? "negative" : "default";
    case "humidity":
      return value >= 70 ? "negative" : "default";
    case "precip":
      return value >= 10 ? "negative" : "default";
    case "wind":
      return value >= 25 ? "negative" : "default";
    case "uv":
      return value >= 8 ? "negative" : "default";
    case "pm10":
      return value >= 81 ? "negative" : "default";
    case "pm25":
      return value >= 36 ? "negative" : "default";
    default:
      return "default";
  }
}

async function retryNearbySync(
  cityId: string,
  hints: string[],
  attempts = 3,
): Promise<{ ok: boolean; error: string | null }> {
  let lastError: string | null = null;
  for (let i = 0; i < attempts; i++) {
    const r = await syncNearbyPlaces(cityId, hints);
    if (r.ok) return { ok: true, error: null };
    lastError = r.error ?? "nearby sync failed";
    if (i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, (i + 1) * 900));
    }
  }
  return { ok: false, error: lastError };
}

type NearbyFetchResult = {
  rows: PlaceRow[];
  error: string | null;
};

type ForecastFetchResult = {
  rows: ForecastRow[];
  error: string | null;
};

async function fetchNearbyPlaces(cityId: string): Promise<NearbyFetchResult> {
  if (!supabase) return { rows: [], error: null };
  const sb = supabase;
  const attempts = [
    () =>
      sb
        .from("nearby_places")
        .select(
          "title, category, summary, addr, lat, lon, weather_tags, mode_tags",
        )
        .eq("city_id", cityId)
        .order("cached_at", { ascending: false })
        .limit(24),
    () =>
      sb
        .from("nearby_places")
        .select(
          "title, category, summary, addr, lat, lon, weather_tags, mode_tags",
        )
        .eq("city_id", cityId)
        .limit(24),
    () =>
      sb
        .from("nearby_places")
        .select("title, addr")
        .eq("city_id", cityId)
        .order("cached_at", { ascending: false })
        .limit(24),
    () =>
      sb
        .from("nearby_places")
        .select("title, addr")
        .eq("city_id", cityId)
        .limit(24),
  ] as const;

  for (let i = 0; i < attempts.length; i++) {
    const { data, error } = await attempts[i]();
    if (!error) return { rows: (data ?? []) as PlaceRow[], error: null };
    console.warn(
      `[home] nearby_places try ${i + 1}/${attempts.length}:`,
      error.message,
    );
  }

  const { error } = await attempts[0]();
  return { rows: [], error: error?.message ?? "unknown nearby_places error" };
}

async function fetchHomeCards(cityId: string): Promise<HomeCardRow[]> {
  if (!supabase) return [];
  const sb = supabase;
  const attempts = [
    () =>
      sb
        .from("home_cards")
        .select(
          "id, title, subtitle, nights_label, date_label, image_url, card_type, date_from, date_to, sort_order, mode_tags",
        )
        .eq("city_id", cityId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .limit(12),
    () =>
      sb
        .from("home_cards")
        .select(
          "id, title, subtitle, nights_label, date_label, image_url, card_type, date_from, date_to, sort_order, mode_tags",
        )
        .eq("city_id", cityId)
        .eq("is_active", true)
        .order("id", { ascending: true })
        .limit(12),
    () =>
      sb
        .from("home_cards")
        .select(
          "id, title, subtitle, nights_label, date_label, image_url, card_type, date_from, date_to, sort_order, mode_tags",
        )
        .eq("city_id", cityId)
        .eq("is_active", true)
        .limit(12),
    () =>
      sb
        .from("home_cards")
        .select("id, title, subtitle, image_url, card_type")
        .eq("city_id", cityId)
        .limit(12),
  ] as const;
  for (let i = 0; i < attempts.length; i++) {
    const { data, error } = await attempts[i]();
    if (!error) return (data ?? []) as HomeCardRow[];
    console.warn(
      `[home] home_cards try ${i + 1}/${attempts.length}:`,
      error.message,
    );
  }
  return [];
}

async function fetchForecastRows(
  cityId: string,
  nowIso: string,
): Promise<ForecastFetchResult> {
  if (!supabase) return { rows: [], error: null };
  const sb = supabase;
  const attempts = [
    () =>
      sb
        .from("forecast_weather")
        .select(
          "timestamp, temperature, weather_code, precipitation, wind_speed, humidity",
        )
        .eq("city_id", cityId)
        .gte("timestamp", nowIso)
        .order("timestamp", { ascending: true })
        .limit(168),
    () =>
      sb
        .from("forecast_weather")
        .select("timestamp, temperature, weather_code, precipitation")
        .eq("city_id", cityId)
        .gte("timestamp", nowIso)
        .order("timestamp", { ascending: true })
        .limit(168),
  ] as const;

  for (let i = 0; i < attempts.length; i++) {
    const { data, error } = await attempts[i]();
    if (!error) return { rows: (data ?? []) as ForecastRow[], error: null };
    console.warn(
      `[home] forecast_weather try ${i + 1}/${attempts.length}:`,
      error.message,
    );
  }

  const { error } = await attempts[0]();
  return { rows: [], error: error?.message ?? "unknown forecast_weather error" };
}

/* ── ggg 로고 도트 (가로) ── */
function GggDots({ size = 16 }: { size?: number }) {
  const overlap = Math.round(size * 0.35);
  return (
    <span
      className="home-ggg-dots"
      style={
        { "--dot": `${size}px`, "--ov": `-${overlap}px` } as React.CSSProperties
      }
    >
      <span className="home-ggg-dot home-ggg-dot--green" />
      <span className="home-ggg-dot home-ggg-dot--purple" />
      <span className="home-ggg-dot home-ggg-dot--blue" />
    </span>
  );
}

/* ── gs 추천 배지 (세로 dots + 텍스트 아래) ── */
type GsGrade = "gorgeous" | "great" | "good" | "meh";
const GS_COLORS: Record<GsGrade, string> = {
  gorgeous: "#5260FE",
  great: "#C871FD",
  good: "#13EA00",
  meh: "#888",
};
const GS_LABELS: Record<GsGrade, string> = {
  gorgeous: "강력\n추천",
  great: "추천",
  good: "보통",
  meh: "비추",
};

function GsScore({ grade }: { grade: GsGrade }) {
  const dotCount =
    grade === "gorgeous" ? 3 : grade === "great" ? 2 : grade === "good" ? 1 : 0;
  const dotColors = ["#5260FE", "#C871FD", "#13EA00"]; // blue, purple, green (top to bottom)
  return (
    <div className="home-gs-score">
      <div className="home-gs-score__dots">
        {Array.from({ length: dotCount }).map((_, i) => (
          <span
            key={i}
            className="home-gs-score__dot"
            style={{ background: dotColors[i] ?? "#13EA00" }}
          />
        ))}
      </div>
      <span
        className="home-gs-score__label"
        style={{ color: GS_COLORS[grade] }}
      >
        {GS_LABELS[grade]}
      </span>
    </div>
  );
}

/* ── 5일 기온 그래프 (SVG) ── */
function TempGraph({ days }: { days: DailySummary[] }) {
  const vals = days.flatMap((d) => [d.max, d.min]).filter((v): v is number => v != null);
  if (vals.length < 2) return null;
  const globalMin = Math.min(...vals),
    globalMax = Math.max(...vals);
  const range = globalMax - globalMin || 1;
  const W = 500,
    H = 120,
    PAD_X = 20,
    PAD_Y = 18;
  const innerW = W - PAD_X * 2,
    innerH = H - PAD_Y * 2;
  const xOf = (i: number) => PAD_X + (i / (days.length - 1 || 1)) * innerW;
  const yOf = (v: number) => PAD_Y + (1 - (v - globalMin) / range) * innerH;
  const pts = days.map((d, i) => {
    const v = d.max;
    return v != null ? [xOf(i), yOf(v)] : null;
  });
  const valid = pts.filter((p): p is [number, number] => p != null);
  if (valid.length < 2) return null;
  const linePath = valid
    .map(
      (p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`,
    )
    .join(" ");
  const first = valid[0];
  const last = valid[valid.length - 1];
  const areaPath = `${linePath} L${last[0].toFixed(1)},${H.toFixed(1)} L${first[0].toFixed(1)},${H.toFixed(1)} Z`;
  return (
    <div className="home-forecast-graph home-forecast-graph--overlay">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} aria-hidden>
        <defs>
          <linearGradient id="forecastTempOverlay" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7ad8be" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#7ad8be" stopOpacity="0.03" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#forecastTempOverlay)" />
        <path
          d={linePath}
          stroke="#5fbca2"
          strokeWidth="2.2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

/* ── 메트릭 상세 인라인 패널 ── */
type MetricTone = "positive" | "neutral" | "negative";
const METRIC_DETAIL: Record<
  string,
  { title: string; text: string; tone: MetricTone }
> = {
  feels: {
    title: "체감기온 안내",
    text: "실제 온도보다 덥거나 춥게 느껴지는 정도에요. 습도·바람 영향을 반영한 값으로, 옷차림 선택의 기준이 됩니다.",
    tone: "positive",
  },
  rain: {
    title: "강수확률 안내",
    text: "앞으로 24시간 동안 비가 내릴 가능성이에요. 60% 이상이면 우산을 챙기거나 실내 대안을 준비해 두세요.",
    tone: "negative",
  },
  humidity: {
    title: "습도 안내",
    text: "공기 중 수분 비율이에요. 60% 이상이면 끈적한 느낌, 40% 이하면 건조해서 피부·목에 신경 써야 해요.",
    tone: "neutral",
  },
  precip: {
    title: "강수량 안내",
    text: "하루 동안 내린 비·눈의 양(mm)이에요. 10mm 이상이면 신발이 젖을 수 있으니 방수 신발을 추천해요.",
    tone: "negative",
  },
  wind: {
    title: "바람 안내",
    text: "풍속(km/h)이에요. 20km/h 이상이면 우산이 뒤집힐 수 있고, 30km/h 이상이면 야외 활동이 불편할 수 있어요.",
    tone: "neutral",
  },
  uv: {
    title: "자외선 지수 안내",
    text: "UV 지수 6 이상이면 자외선 차단제와 모자가 필요해요. 가족 모드에서는 안전 알림이 강화됩니다.",
    tone: "negative",
  },
  pm10: {
    title: "미세먼지 안내",
    text: "PM10이 80㎍/㎥ 이상이면 장시간 야외활동을 줄이고 마스크를 착용하세요.",
    tone: "negative",
  },
  pm25: {
    title: "초미세먼지 안내",
    text: "PM2.5가 35㎍/㎥ 이상이면 민감군(어린이·노인·임산부)은 야외 활동을 자제해야 해요.",
    tone: "negative",
  },
};

/* ── home-cards 기본 템플릿 ── */
type HomeCardData = {
  title: string;
  subtitle: string;
  cta: string;
  to: string;
  color: "blue" | "green" | "purple";
  emoji: string;
};
function defaultHomeCards(couple: boolean, family: boolean): HomeCardData[] {
  if (family)
    return [
      {
        title: "D-day 날씨 예보",
        subtitle: "가족 여행·약속 날짜의 날씨를 미리 확인해 두세요",
        cta: "D-day 저장하기",
        to: "/dday",
        color: "blue",
        emoji: "📅",
      },
      {
        title: "안전 지수 확인",
        subtitle: "PM2.5·UV 기반 오늘의 가족 외출 안전도",
        cta: "ggg score 보기",
        to: "/score",
        color: "green",
        emoji: "🛡️",
      },
      {
        title: "가족 코스 추천",
        subtitle: "아이와 무리 없는 실내·야외 1일 루트",
        cta: "장소 탐색하기",
        to: "/place",
        color: "purple",
        emoji: "🗺️",
      },
    ];
  if (couple)
    return [
      {
        title: "D-day 날씨 예보",
        subtitle: "기념일·여행 날짜 날씨를 미리 확인해요",
        cta: "D-day 저장하기",
        to: "/dday",
        color: "blue",
        emoji: "💌",
      },
      {
        title: "오늘의 감성 코스",
        subtitle: "골든아워·야경·카페 중심 데이트 동선",
        cta: "장소 보기",
        to: "/place",
        color: "purple",
        emoji: "🌅",
      },
      {
        title: "주변 탐색",
        subtitle: "지금 날씨에 딱 맞는 주변 스팟 큐레이션",
        cta: "지도로 보기",
        to: "/nearby",
        color: "green",
        emoji: "📍",
      },
    ];
  return [
    {
      title: "D-day 날씨 예보",
      subtitle: "여행·약속 날짜의 날씨를 미리 확인해요",
      cta: "D-day 저장하기",
      to: "/dday",
      color: "blue",
      emoji: "📅",
    },
    {
      title: "주변 탐색",
      subtitle: "지금 컨디션에 맞는 주변 활동 큐레이션",
      cta: "지도로 보기",
      to: "/nearby",
      color: "green",
      emoji: "📍",
    },
    {
      title: "숨은 황금 시즌",
      subtitle: "같은 도시의 다른 매력 시기를 비교해요",
      cta: "시즌 비교",
      to: "/hidden-season",
      color: "purple",
      emoji: "✨",
    },
  ];
}

export function HomeProdPage() {
  const { openSidebar } = useSidebar();
  const mode = useModeStore();
  const { cities, cityId, setCityId, citiesLoading, citiesError } = useCities(
    500,
    "home:last-city-id",
  );
  const [forecast, setForecast] = useState<ForecastRow[]>([]);
  const [freq, setFreq] = useState<FreqRow | null>(null);
  const [places, setPlaces] = useState<PlaceRow[]>([]);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [homeCards, setHomeCards] = useState<HomeCardRow[]>([]);
  const [airPm25, setAirPm25] = useState<number | null>(null);
  const [uvIndex, setUvIndex] = useState<number | null>(null);
  const [airPm25ByDay, setAirPm25ByDay] = useState<DailyValueMap>({});
  const [uvIndexByDay, setUvIndexByDay] = useState<DailyValueMap>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [geoLabel, setGeoLabel] = useState<string | null>(null);
  const [nearestKm, setNearestKm] = useState<number | null>(null);
  const [userCoords, setUserCoords] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [citiesPickedByUser, setCitiesPickedByUser] = useState(false);
  const [insightExpanded, setInsightExpanded] = useState(true);
  const [heroCompact, setHeroCompact] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [assistOpen, setAssistOpen] = useState(false);
  const [assistMetricKey, setAssistMetricKey] = useState<string | null>(null);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const showLoading = citiesLoading || loading;

  const loadTokenRef = useRef(0);
  const cityIdRef = useRef(cityId);
  const doy = useMemo(() => dayOfYear(new Date()), []);

  useEffect(() => {
    cityIdRef.current = cityId;
  }, [cityId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onScroll = () => {
      const y = window.scrollY;
      setHeroCompact((prev) => (prev ? y > 170 : y > 220));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (
      !cities.length ||
      typeof navigator === "undefined" ||
      !navigator.geolocation
    )
      return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (citiesPickedByUser) return;
        setUserCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        const n = nearestCity(
          pos.coords.latitude,
          pos.coords.longitude,
          cities,
        );
        if (!n) return;
        setNearestKm(n.km);
        setCityId(n.id);
        const place = await reverseLabelKo(
          pos.coords.latitude,
          pos.coords.longitude,
        );
        if (place) setGeoLabel(place);
      },
      () => {},
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 120_000 },
    );
  }, [cities, citiesPickedByUser, setCityId]);

  const currentCity = useMemo(
    () => cities.find((c) => c.id === cityId) ?? null,
    [cities, cityId],
  );

  const loadHome = useCallback(async () => {
    if (!supabase || !cityId) return;
    const token = ++loadTokenRef.current;
    const cid = cityId;
    setLoading(true);
    setError(false);
    setPlacesError(null);
    const nowIso = new Date().toISOString();
    const c0 = cities.find((x) => x.id === cid);
    const la0 = c0?.lat,
      lo0 = c0?.lon;
    const hasCoords =
      la0 != null &&
      lo0 != null &&
      !Number.isNaN(Number(la0)) &&
      !Number.isNaN(Number(lo0));
    const weatherCachePromise = hasCoords
      ? fetchWeatherCache({
          cityId: cid,
          lat: Number(la0),
          lon: Number(lo0),
        })
      : Promise.resolve({ data: null, error: "missing city coordinates" });
    try {
      const [fr, fq, wx] = await Promise.all([
        fetchForecastRows(cid, nowIso),
        supabase
          .from("climate_frequency")
          .select(
            "day_of_year, clear_days, rain_days, snow_days, total_years, period_start, period_end",
          )
          .eq("city_id", cid)
          .eq("day_of_year", doy)
          .maybeSingle(),
        weatherCachePromise,
      ]);
      if (import.meta.env.DEV) {
        if (wx.error) {
          console.warn("[home] weather-cache error:", wx.error);
        } else if (wx.data) {
          console.info("[home] weather-cache", {
            city_id: wx.data.city_id,
            cache_hit: wx.data.cache_hit,
            stale: wx.data.stale ?? false,
            cached_at: wx.data.cached_at,
            forecast_rows: wx.data.forecast_rows?.length ?? 0,
          });
        }
      }
      if (fr.error || fq.error) {
        setError(true);
        setForecast([]);
        setFreq(null);
        setPlaces([]);
        setHomeCards([]);
        setPlacesError(null);
        return;
      }
      const nowMs = Date.now();
      const filterFromNow = (rows: ForecastRow[]) => {
        const future = rows.filter((row) => {
          const t = Date.parse(row.timestamp);
          return Number.isFinite(t) && t >= nowMs - 45 * 60_000;
        });
        return (future.length ? future : rows).slice(0, 168);
      };
      const cachedRows = (wx.data?.forecast_rows ?? []) as ForecastRow[];
      const forecastRows =
        cachedRows.length > 0
          ? filterFromNow(cachedRows)
          : filterFromNow(fr.rows);
      const pmByDay = (wx.data?.pm25_by_day ?? {}) as DailyValueMap;
      const uvByDay = (wx.data?.uv_by_day ?? {}) as DailyValueMap;
      const todayKey = formatDateKeyInTimeZone(new Date(), "Asia/Seoul");
      const orderedKeys = Array.from(
        new Set([...Object.keys(pmByDay), ...Object.keys(uvByDay)]),
      ).sort((a, b) => a.localeCompare(b));
      const pmForHint = pickDailyValue(pmByDay, todayKey, orderedKeys);
      const uvForHint = pickDailyValue(uvByDay, todayKey, orderedKeys);
      if (token !== loadTokenRef.current || cid !== cityIdRef.current) return;
      setForecast(forecastRows);
      setAirPm25ByDay(pmByDay);
      setUvIndexByDay(uvByDay);
      setAirPm25(pmForHint);
      setUvIndex(uvForHint);
      setFreq((fq.data as FreqRow | null) ?? null);
      const [prResult, hrRows] = await Promise.all([
        fetchNearbyPlaces(cid),
        fetchHomeCards(cid),
      ]);
      if (token !== loadTokenRef.current || cid !== cityIdRef.current) return;
      let nextPlaces = prResult.rows;
      let nextPlacesError = prResult.error;

      if (!nextPlacesError && nextPlaces.length === 0) {
        const rain = rainChance(forecastRows.slice(0, 24));
        const avg = avgTemperature(forecastRows.slice(0, 24));
        const hintWeather = deriveNearbyWeatherHints({
          rainChance: rain,
          avgTemp: avg,
          pm25: pmForHint,
          uv: uvForHint,
          code: forecastRows[0]?.weather_code ?? null,
        });
        const sync = await retryNearbySync(cid, hintWeather, 3);
        if (!sync.ok) {
          nextPlacesError = `${sync.error ?? "nearby sync failed"} (자동 재시도 3회 실패)`;
        } else {
          const retry = await fetchNearbyPlaces(cid);
          nextPlaces = retry.rows;
          nextPlacesError = retry.error;
        }
      }

      setPlaces(nextPlaces);
      setPlacesError(nextPlacesError);
      setHomeCards(hrRows);
    } catch {
      setError(true);
      setForecast([]);
      setAirPm25(null);
      setUvIndex(null);
      setAirPm25ByDay({});
      setUvIndexByDay({});
      setFreq(null);
      setPlaces([]);
      setHomeCards([]);
      setPlacesError(null);
    } finally {
      if (token === loadTokenRef.current) setLoading(false);
    }
  }, [cities, cityId, doy]);

  useEffect(() => {
    void loadHome();
  }, [loadHome]);

  const first = forecast[0] ?? null;
  const daily = useMemo(() => summarizeDaily(forecast), [forecast]);
  const todayRain = rainChance(forecast.slice(0, 24));
  const avgTemp = avgTemperature(forecast.slice(0, 24));
  const today = daily[0];
  const cityName = currentCity?.name_ko ?? null;

  const heroTitle = first
    ? first.weather_code != null && [0, 1, 2].includes(first.weather_code)
      ? "오늘은 야외 활동 최적의 하루!"
      : "오늘 컨디션에 맞춰 일정을 조정해 보세요"
    : "오늘 날씨 데이터를 준비하고 있어요";

  const insightText = useMemo(() => {
    if (freq) {
      const rainPart =
        todayRain != null && todayRain > 40
          ? " 오후 강수 가능성이 있으니 우산을 준비해 두세요."
          : "";
      return `최근 ${freq.total_years}년 기준, 오늘과 같은 날은 맑음 ${freq.clear_days}일 · 비 ${freq.rain_days}일 · 눈 ${freq.snow_days}일이었어요.${rainPart}`;
    }
    return "오늘의 날씨 인사이트를 분석 중이에요. 잠시만 기다려 주세요.";
  }, [freq, todayRain]);

  const clothingTags = useMemo(
    () =>
      clothingSuggestions(
        first?.temperature ?? null,
        first?.weather_code ?? null,
        airPm25,
      ),
    [first, airPm25],
  );

  const grade = useMemo(
    () =>
      gradeFromInputs(first?.weather_code ?? null, todayRain, airPm25, uvIndex),
    [airPm25, first?.weather_code, todayRain, uvIndex],
  );

  const nearbyWeatherHints = useMemo(
    () =>
      deriveNearbyWeatherHints({
        rainChance: todayRain,
        avgTemp,
        pm25: airPm25,
        uv: uvIndex,
        code: first?.weather_code ?? null,
      }),
    [airPm25, avgTemp, first?.weather_code, todayRain, uvIndex],
  );

  const weatherSortedPlaces = useMemo(() => {
    if (!places.length) return places;
    return [...places].sort(
      (a, b) =>
        scoreWeatherTag(b.weather_tags, nearbyWeatherHints) -
        scoreWeatherTag(a.weather_tags, nearbyWeatherHints),
    );
  }, [nearbyWeatherHints, places]);

  const filteredPlaces = useMemo(
    () => pickModeAwareRows(weatherSortedPlaces, mode.couple, mode.family, 3),
    [mode.couple, mode.family, weatherSortedPlaces],
  );
  const placeFilterFallback =
    weatherSortedPlaces.length > 0 && filteredPlaces.length === 0;
  const visiblePlaces = placeFilterFallback
    ? weatherSortedPlaces.slice(0, 3)
    : filteredPlaces;

  const placeDistanceText = useCallback(
    (place: PlaceRow) => {
      const la = place.lat;
      const lo = place.lon;
      if (la == null || lo == null || Number.isNaN(la) || Number.isNaN(lo)) {
        return "거리 정보 준비 중";
      }
      const base =
        userCoords ??
        (currentCity?.lat != null &&
        currentCity?.lon != null &&
        Number.isFinite(currentCity.lat) &&
        Number.isFinite(currentCity.lon)
          ? { lat: currentCity.lat, lon: currentCity.lon }
          : null);
      if (!base) return "거리 정보 준비 중";
      const km = haversineKm(base.lat, base.lon, la, lo);
      return formatDistance(km);
    },
    [currentCity, userCoords],
  );

  const openPlaceMap = useCallback((place: PlaceRow) => {
    const webUrl = naverMapWebUrl(place);
    const appUrl = naverMapAppUrl(place);
    const nativeApp =
      typeof window !== "undefined" &&
      Boolean(
        (
          window as unknown as {
            Capacitor?: { isNativePlatform?: () => boolean };
          }
        ).Capacitor?.isNativePlatform?.(),
      );
    const ua = navigator.userAgent.toLowerCase();
    const mobileUa = /iphone|ipad|android/.test(ua);
    if (nativeApp || mobileUa) {
      const started = Date.now();
      window.location.href = appUrl;
      window.setTimeout(() => {
        if (Date.now() - started < 1600) window.location.href = webUrl;
      }, 900);
      return;
    }
    window.open(webUrl, "_blank", "noopener,noreferrer");
  }, []);

  const filteredHomeCards = useMemo(
    () => pickModeAwareRows(homeCards, mode.couple, mode.family, 3),
    [homeCards, mode.couple, mode.family],
  );

  const cardRows = useMemo((): HomeCardData[] => {
    if (filteredHomeCards.length) {
      return filteredHomeCards.map((card) => ({
        title: card.title,
        subtitle:
          card.subtitle ??
          ([card.nights_label, card.date_label].filter(Boolean).join(" · ") ||
            "추천 일정을 확인해 보세요."),
        cta: "자세히 보기",
        to: "/",
        color: "blue" as const,
        emoji: "📌",
      }));
    }
    return defaultHomeCards(mode.couple, mode.family);
  }, [filteredHomeCards, mode.couple, mode.family]);

  const metricCards = useMemo(
    () => [
      {
        key: "feels",
        label: "체감기온",
        value: avgTemp != null ? `${Math.round(avgTemp)}` : "—",
        numericValue: avgTemp != null ? Math.round(avgTemp) : null,
        unit: "°C",
        color: "blue",
      },
      {
        key: "rain",
        label: "강수확률",
        value: todayRain != null ? `${todayRain}` : "—",
        numericValue: todayRain,
        unit: "%",
        color: "yellow",
      },
      {
        key: "humidity",
        label: "습도",
        value: today?.humidityAvg != null ? `${today.humidityAvg}` : "—",
        numericValue: today?.humidityAvg ?? null,
        unit: "%",
        color: "yellow",
      },
      {
        key: "precip",
        label: "강수량",
        value: today?.precipSum != null ? `${today.precipSum}` : "—",
        numericValue: today?.precipSum ?? null,
        unit: "mm",
        color: "yellow",
      },
      {
        key: "wind",
        label: "바람",
        value: today?.windAvg != null ? `${today.windAvg}` : "—",
        numericValue: today?.windAvg ?? null,
        unit: "km/h",
        color: "blue",
      },
      {
        key: "uv",
        label: "자외선",
        value: uvIndex != null ? `${uvIndex.toFixed(1)}` : "—",
        numericValue: uvIndex,
        unit: "uv",
        color: "purple",
      },
      {
        key: "pm10",
        label: "미세먼지",
        value: airPm25 != null ? `${Math.round(airPm25 * 1.5)}` : "—",
        numericValue: airPm25 != null ? Math.round(airPm25 * 1.5) : null,
        unit: "㎍/㎥",
        color: "green",
      },
      {
        key: "pm25",
        label: "초미세먼지",
        value: airPm25 != null ? `${Math.round(airPm25)}` : "—",
        numericValue: airPm25 != null ? Math.round(airPm25) : null,
        unit: "㎍/㎥",
        color: "green",
      },
    ],
    [avgTemp, todayRain, today, uvIndex, airPm25],
  );

  const selectedCard = useMemo(
    () => metricCards.find((card) => card.key === selectedMetric) ?? null,
    [metricCards, selectedMetric],
  );

  const metricHourly = useMemo(() => {
    if (!selectedMetric) return [];
    const nextHours = forecast.slice(0, 24);
    return nextHours.map((row) => {
      const d = new Date(row.timestamp);
      const hour = Number.isNaN(d.getTime()) ? "--" : `${d.getHours()}시`;
      const value = (() => {
        switch (selectedMetric) {
          case "feels":
            return row.temperature != null
              ? `${Math.round(row.temperature)}°`
              : "—";
          case "rain":
          case "precip":
            return row.precipitation != null ? `${row.precipitation}mm` : "—";
          case "humidity":
            return row.humidity != null ? `${Math.round(row.humidity)}%` : "—";
          case "wind":
            return row.wind_speed != null
              ? `${Math.round(row.wind_speed * 10) / 10}`
              : "—";
          case "uv":
            return uvIndex != null ? `${uvIndex.toFixed(0)}` : "—";
          case "pm10":
            return airPm25 != null ? `${Math.round(airPm25 * 1.5)}` : "—";
          case "pm25":
            return airPm25 != null ? `${Math.round(airPm25)}` : "—";
          default:
            return "—";
        }
      })();
      return { key: row.timestamp, hour, code: row.weather_code, value };
    });
  }, [airPm25, forecast, selectedMetric, uvIndex]);
  const metricRows = useMemo(
    () => [metricCards.slice(0, 4), metricCards.slice(4, 8)],
    [metricCards],
  );

  const metricTravelGuide = useMemo(() => {
    if (!selectedMetric)
      return "오늘 날씨 데이터를 바탕으로 여행 동선을 안내해 드려요.";
    switch (selectedMetric) {
      case "feels": {
        if (avgTemp == null) return "체감기온 데이터를 모으는 중이에요.";
        if (avgTemp <= 5)
          return "오늘은 추워요. 실내 중심 일정 + 방풍 겉옷이 좋아요.";
        if (avgTemp >= 28)
          return "더위가 강해요. 실내/그늘 동선을 중심으로 잡아보세요.";
        return "야외 이동하기 무난한 체감이에요. 낮~오후 일정 배치가 좋아요.";
      }
      case "rain":
      case "precip": {
        const rainScore = todayRain ?? today?.precipSum ?? null;
        if (rainScore == null) return "강수 데이터를 모으는 중이에요.";
        if ((todayRain ?? 0) >= 60 || (today?.precipSum ?? 0) >= 10)
          return "비 영향이 커요. 실내 플랜B를 우선 준비하세요.";
        if ((todayRain ?? 0) >= 30)
          return "소나기 가능성이 있어요. 짧은 우산과 이동 여유 시간을 확보하세요.";
        return "강수 리스크가 낮아요. 야외 활동 중심으로 계획해도 좋아요.";
      }
      case "humidity": {
        const h = today?.humidityAvg ?? null;
        if (h == null) return "습도 데이터를 모으는 중이에요.";
        if (h >= 75)
          return "습도가 높아 체감 피로가 커질 수 있어요. 실내 휴식 포인트를 끼워 넣으세요.";
        if (h <= 35)
          return "건조한 날이에요. 수분 보충과 보습 대비를 챙기세요.";
        return "습도는 무난한 편이에요. 일반 이동 동선으로 충분해요.";
      }
      case "wind": {
        const w = today?.windAvg ?? null;
        if (w == null) return "바람 데이터를 모으는 중이에요.";
        if (w >= 25)
          return "바람이 강해요. 고지대/해변 체류 시간을 줄이는 편이 좋아요.";
        if (w >= 15)
          return "돌풍 구간이 있을 수 있어요. 가벼운 겉옷을 추천해요.";
        return "바람은 약한 편이에요. 야외 사진/산책 일정이 무난해요.";
      }
      case "uv": {
        if (uvIndex == null) return "자외선 데이터를 모으는 중이에요.";
        if (uvIndex >= 8)
          return "자외선이 매우 강해요. 한낮 야외 체류를 짧게 나누세요.";
        if (uvIndex >= 6)
          return "자외선이 강한 구간이 있어요. 모자/선크림 준비를 권장해요.";
        return "자외선 부담이 낮아요. 야외 일정도 무난하게 소화할 수 있어요.";
      }
      case "pm10":
      case "pm25": {
        if (airPm25 == null) return "대기질 데이터를 모으는 중이에요.";
        if (airPm25 >= 35)
          return "대기질이 좋지 않아요. 실내 일정 비중을 높여보세요.";
        if (airPm25 >= 20) return "민감군은 마스크를 준비하면 더 안전해요.";
        return "대기질이 비교적 좋아요. 야외 일정 진행에 무리가 적어요.";
      }
      default:
        return "오늘 날씨 데이터를 바탕으로 여행 동선을 안내해 드려요.";
    }
  }, [airPm25, avgTemp, selectedMetric, today, todayRain, uvIndex]);

  const weekSummary = useMemo(() => {
    if (!daily.length) return "이번 주 날씨 흐름을 분석 중이에요.";
    const rainyDays = daily
      .slice(0, 5)
      .filter((d) => (d.rainChance ?? 0) >= 40).length;
    const maxT = Math.max(...daily.slice(0, 5).map((d) => d.max ?? -99));
    const minT = Math.min(...daily.slice(0, 5).map((d) => d.min ?? 99));
    if (rainyDays >= 3)
      return `이번 주 강수 일수가 많아요. 우산을 챙기고 실내 일정 비중을 높여보세요.`;
    if (maxT - minT > 15)
      return `일교차가 크게 벌어지는 한 주예요. 겉옷을 꼭 챙겨 두세요.`;
    return `최고 ${Math.round(maxT)}° · 최저 ${Math.round(minT)}°, 무난한 한 주가 될 것 같아요.`;
  }, [daily]);

  if (!supabase) {
    return (
      <div className="home-page">
        <PageStatus
          variant="error"
          message={PAGE_STATUS_COPY.supabaseMissing}
        />
      </div>
    );
  }

  return (
    <div className="home-page">
      {nearestKm != null && nearestKm > PIONEER_HINT_KM ? (
        <div className="prod-callout">
          등록 도시와 거리가 멀어요. 미션 탭에서 새 지역 데이터 확장을 요청할 수
          있어요.
        </div>
      ) : null}
      {citiesError ? <PageStatus variant="error" /> : null}

      {/* ══════════════ HERO ══════════════ */}
      <div className={`home-hero${heroCompact ? " home-hero--compact" : ""}`}>
        {/* 타이틀 행 — 항상 표시 */}
        <div className="home-hero__toprow">
          <div className="home-hero__brand">
            <GggDots size={heroCompact ? 12 : 18} />
            <span className="home-hero__msg">{heroTitle}</span>
          </div>
          <button
            type="button"
            className="home-hero__menu-btn"
            aria-label="메뉴 열기"
            onClick={openSidebar}
          >
            <span />
            <span />
            <span />
          </button>
        </div>

        {/* 날씨 + 온도 */}
        <div
          className={`home-hero__weather${heroCompact ? " home-hero__weather--hidden" : ""}`}
        >
          <div className="home-hero__weather-left">
            <img
              className="home-hero__weather-icon"
              src={weatherIcon(first?.weather_code ?? null)}
              alt={weatherLabel(first?.weather_code ?? null)}
            />
            <p className="home-hero__location">
              {geoLabel ?? cityName ?? "위치 확인 중"}
            </p>
          </div>
          <div className="home-hero__weather-right">
            <div className="home-hero__temp-row">
              <span className="home-hero__temp">
                {first?.temperature != null
                  ? Math.round(first.temperature)
                  : "—"}
              </span>
              <span className="home-hero__temp-unit">° C</span>
            </div>
            <div className="home-hero__temp-range">
              <span>
                최저 {today?.min != null ? `${Math.round(today.min)}°` : "—"}
              </span>
              <span>
                최고 {today?.max != null ? `${Math.round(today.max)}°` : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* insight 카드 */}
        <div className="home-insight">
          <div className="home-insight__head">
            <span className="home-insight__badge">insight</span>
            {/* iOS 스타일 토글 */}
            <button
              type="button"
              role="switch"
              aria-checked={insightExpanded}
              className={`home-insight__toggle${insightExpanded ? " home-insight__toggle--on" : ""}`}
              onClick={() => setInsightExpanded((v) => !v)}
              aria-label="인사이트 펼치기/접기"
            >
              <span className="home-insight__toggle-thumb" />
            </button>
          </div>
          <div
            className={`home-insight__content${insightExpanded ? " home-insight__content--open" : ""}`}
          >
            <p className="home-insight__text">{insightText}</p>
            {clothingTags.length > 0 && (
              <div className="home-insight__tags">
                {clothingTags.map((tag) => (
                  <span key={tag} className="home-insight__tag">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 로딩 / 에러 */}
      {error ? <PageStatus variant="error" /> : null}
      {showLoading ? <PageStatus variant="loading" /> : null}

      {!showLoading && !error && (
        <>
          {/* ══════════════ 오늘 날씨 예상 ══════════════ */}
          <section className="home-section">
            <h2 className="home-section__title">오늘 날씨 예상</h2>
            {metricRows.map((rowCards, rowIndex) => {
              return (
                <div key={`metric-row-${rowIndex}`}>
                  <div className="home-metric-grid">
                    {rowCards.map((card) => (
                      <button
                        key={card.key}
                        type="button"
                        className={`home-metric-card home-metric-card--${card.color}${selectedMetric === card.key ? " home-metric-card--active" : ""}`}
                        onClick={() =>
                          setSelectedMetric((prev) =>
                            prev === card.key ? null : card.key,
                          )
                        }
                      >
                        <span className="home-metric-card__label">
                          {card.label}
                        </span>
                        <div className="home-metric-card__val">
                          <strong
                            className={`home-metric-card__val-strong home-metric-card__val-strong--${metricValueTone(
                              card.key,
                              card.numericValue,
                            )}`}
                          >
                            {card.value}
                          </strong>
                          <span>{card.unit}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                  {selectedMetric &&
                    METRIC_DETAIL[selectedMetric] &&
                    selectedCard &&
                    rowIndex === 0 && (
                      <div className="home-metric-detail">
                        <div className="home-metric-detail__header">
                          <div
                            className={`home-metric-detail__picked home-metric-detail__picked--${selectedCard.color}`}
                          >
                            <span className="home-metric-detail__picked-label">
                              <span>{selectedCard.label}</span>
                              <button
                                type="button"
                                className="home-metric-detail__help"
                                onClick={() => {
                                  setAssistMetricKey(selectedMetric);
                                  setAssistOpen(true);
                                }}
                                aria-label={`${selectedCard.label} 도움말`}
                              >
                                <CircleHelp size={12} strokeWidth={2.2} />
                              </button>
                            </span>
                            <div className="home-metric-detail__picked-value">
                              <strong>{selectedCard.value}</strong>
                              <span>{selectedCard.unit}</span>
                            </div>
                          </div>
                          {metricHourly.length > 0 && (
                            <div className="home-metric-detail__hourly-scroll">
                              <div className="home-metric-detail__hourly">
                                {metricHourly.map((item) => (
                                  <div
                                    key={item.key}
                                    className="home-metric-detail__hour"
                                  >
                                    <span className="home-metric-detail__hour-top">
                                      {item.value}
                                    </span>
                                    <img
                                      src={weatherIcon(item.code)}
                                      alt=""
                                      className="home-metric-detail__hour-icon"
                                    />
                                    <span className="home-metric-detail__hour-time">
                                      {item.hour}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div
                          className={`home-metric-detail__footer home-metric-detail__footer--${METRIC_DETAIL[selectedMetric].tone}`}
                        >
                          <p className="home-metric-detail__text">
                            {metricTravelGuide}
                          </p>
                        </div>
                      </div>
                    )}
                </div>
              );
            })}
          </section>

          {/* ══════════════ 지금 가기 좋은 곳 ══════════════ */}
          <section className="home-section">
            <h2 className="home-section__title">
              {cityName
                ? `${cityName}, 지금 가기 좋은 곳`
                : "지금 가기 좋은 곳"}
            </h2>
            {placesError ? (
              <PageStatus
                variant="error"
                message={`주변 추천 조회에 실패했어요: ${placesError}`}
              />
            ) : visiblePlaces.length === 0 ? (
              <PageStatus
                variant="empty"
                message="이 도시에 대한 nearby_places가 없거나 city_id가 cities.id와 다를 수 있어요."
              />
            ) : (
              <div className="home-place-list">
                {visiblePlaces.map((place, idx) => {
                  const placeGrade: GsGrade =
                    idx === 0 ? "gorgeous" : idx === 1 ? "great" : "good";
                  return (
                    <div
                      key={`${place.title}-${idx}`}
                      className={`home-place-card home-place-card--${placeGrade}`}
                    >
                      <div className="home-place-card__body">
                        <div className="home-place-card__head">
                          <h3 className="home-place-card__name">
                            {place.title}
                          </h3>
                          <p className="home-place-card__desc">
                            {place.summary?.trim() || "요약 정보 준비 중"}
                          </p>
                        </div>

                        <div className="home-place-card__map-row">
                          <span className="home-place-card__dist">
                            {placeDistanceText(place)}
                          </span>

                          <button
                            className="home-place-card__map"
                            type="button"
                            onClick={() => openPlaceMap(place)}
                          >
                            위치보기
                          </button>
                        </div>
                      </div>
                      <GsScore grade={placeGrade} />
                    </div>
                  );
                })}
                {placeFilterFallback ? (
                  <p className="page-muted">
                    현재 모드 태그와 정확히 맞는 장소가 없어 기본 추천을
                    보여드려요.
                  </p>
                ) : null}
              </div>
            )}
          </section>

          {/* ══════════════ 5일 예보 ══════════════ */}
          <section className="home-section">
            <h2 className="home-section__title">5일 예보</h2>
            {daily.length === 0 ? (
              <PageStatus variant="empty" />
            ) : (
              <>
                <div className="home-forecast-summary">
                  <p className="home-forecast-summary__text">{weekSummary}</p>
                </div>
                <div className="home-forecast-table">
                  {/* 요일 */}
                  <div className="home-forecast-row home-forecast-row--head">
                    <span className="home-forecast-label" />
                    {daily.slice(0, 5).map((d) => (
                      <span
                        key={d.key}
                        className={`home-forecast-day${d.label === "일" ? " --sun" : d.label === "토" ? " --sat" : ""}`}
                      >
                        {d.label}
                      </span>
                    ))}
                  </div>
                  {/* 날씨 아이콘 */}
                  <div className="home-forecast-row">
                    <span className="home-forecast-label">
                      <span className="home-forecast-label__title">날씨</span>
                      <span className="home-forecast-label__unit">아이콘</span>
                    </span>
                    {daily.slice(0, 5).map((d) => (
                      <img
                        key={d.key}
                        src={weatherIcon(d.code)}
                        className="home-forecast-icon"
                        alt=""
                      />
                    ))}
                  </div>
                  {/* 기온 섹션 (파란 배경) */}
                  <div className="home-forecast-group home-forecast-group--blue">
                    <TempGraph days={daily.slice(0, 5)} />
                    <div className="home-forecast-row">
                      <span className="home-forecast-label home-forecast-label--max">
                        <span className="home-forecast-label__title">최고기온</span>
                        <span className="home-forecast-label__unit">°C</span>
                      </span>
                      {daily.slice(0, 5).map((d) => (
                        <span
                          key={d.key}
                          className="home-forecast-val home-forecast-val--max"
                        >
                          {d.max != null ? Math.round(d.max) : "—"}
                        </span>
                      ))}
                    </div>
                    <div className="home-forecast-row">
                      <span className="home-forecast-label home-forecast-label--min">
                        <span className="home-forecast-label__title">최저기온</span>
                        <span className="home-forecast-label__unit">°C</span>
                      </span>
                      {daily.slice(0, 5).map((d) => (
                        <span
                          key={d.key}
                          className="home-forecast-val home-forecast-val--min"
                        >
                          {d.min != null ? Math.round(d.min) : "—"}
                        </span>
                      ))}
                    </div>
                  </div>
                  {/* 자외선 */}
                  <div className="home-forecast-row home-forecast-row--purple">
                    <span className="home-forecast-label">
                      <span className="home-forecast-label__title">자외선</span>
                      <span className="home-forecast-label__unit">UV index</span>
                    </span>
                    {daily.slice(0, 5).map((d) => (
                      <span key={d.key} className="home-forecast-val">
                        {uvIndexByDay[d.key] != null
                          ? uvIndexByDay[d.key]?.toFixed(0)
                          : "—"}
                      </span>
                    ))}
                  </div>
                  {/* 바람 */}
                  <div className="home-forecast-row home-forecast-row--blue">
                    <span className="home-forecast-label">
                      <span className="home-forecast-label__title">바람</span>
                      <span className="home-forecast-label__unit">km/h</span>
                    </span>
                    {daily.slice(0, 5).map((d) => (
                      <span key={d.key} className="home-forecast-val">
                        {d.windAvg != null ? d.windAvg : "—"}
                      </span>
                    ))}
                  </div>
                  {/* 강수 섹션 (노란 배경) */}
                  <div className="home-forecast-group home-forecast-group--yellow">
                    <div className="home-forecast-row">
                      <span className="home-forecast-label">
                        <span className="home-forecast-label__title">강수확률</span>
                        <span className="home-forecast-label__unit">%</span>
                      </span>
                      {daily.slice(0, 5).map((d) => (
                        <span
                          key={d.key}
                          className={`home-forecast-val${(d.rainChance ?? 0) >= 60 ? " home-forecast-val--alert" : (d.rainChance ?? 0) === 0 ? " home-forecast-val--zero" : ""}`}
                        >
                          {d.rainChance != null ? `${d.rainChance}%` : "—"}
                        </span>
                      ))}
                    </div>
                    <div className="home-forecast-row">
                      <span className="home-forecast-label">
                        <span className="home-forecast-label__title">강수량</span>
                        <span className="home-forecast-label__unit">mm</span>
                      </span>
                      {daily.slice(0, 5).map((d) => (
                        <span
                          key={d.key}
                          className={`home-forecast-val${(d.precipSum ?? 0) > 10 ? " home-forecast-val--alert" : ""}`}
                        >
                          {d.precipSum != null ? `${d.precipSum}` : "—"}
                        </span>
                      ))}
                    </div>
                    <div className="home-forecast-row">
                      <span className="home-forecast-label">
                        <span className="home-forecast-label__title">습도</span>
                        <span className="home-forecast-label__unit">%</span>
                      </span>
                      {daily.slice(0, 5).map((d) => (
                        <span key={d.key} className="home-forecast-val">
                          {d.humidityAvg != null ? `${d.humidityAvg}%` : "—"}
                        </span>
                      ))}
                    </div>
                  </div>
                  {/* 미세먼지 섹션 (초록 배경) */}
                  <div className="home-forecast-group home-forecast-group--green">
                    <div className="home-forecast-row">
                      <span className="home-forecast-label">
                        <span className="home-forecast-label__title">미세먼지</span>
                        <span className="home-forecast-label__unit">ug/m3</span>
                      </span>
                      {daily.slice(0, 5).map((d) => (
                        <span key={d.key} className="home-forecast-val">
                          {airPm25ByDay[d.key] != null
                            ? Math.round((airPm25ByDay[d.key] ?? 0) * 1.5)
                            : "—"}
                        </span>
                      ))}
                    </div>
                    <div className="home-forecast-row">
                      <span className="home-forecast-label">
                        <span className="home-forecast-label__title">초미세먼지</span>
                        <span className="home-forecast-label__unit">ug/m3</span>
                      </span>
                      {daily.slice(0, 5).map((d) => (
                        <span key={d.key} className="home-forecast-val">
                          {airPm25ByDay[d.key] != null
                            ? Math.round(airPm25ByDay[d.key] ?? 0)
                            : "—"}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>

          {/* ══════════════ home-cards ══════════════ */}
          <section className="home-section">
            <h2 className="home-section__title">오늘을 위한 플랜</h2>
            <div className="home-cards">
              {cardRows.map((card, idx) => (
                <Link
                  key={`${card.title}-${idx}`}
                  to={card.to}
                  className={`home-card home-card--${card.color}`}
                >
                  <span className="home-card__emoji">{card.emoji}</span>
                  <div className="home-card__body">
                    <strong className="home-card__title">{card.title}</strong>
                    <p className="home-card__subtitle">{card.subtitle}</p>
                  </div>
                  <span className="home-card__cta">→</span>
                </Link>
              ))}
            </div>
          </section>

          {/* ggg grade */}
          <div className="home-grade-banner">
            <GggDots size={14} />
            <span className="home-grade-banner__text">오늘의 ggg grade</span>
            <span className={`home-grade-chip home-grade-chip--${grade.key}`}>
              {grade.label}
            </span>
          </div>
        </>
      )}

      {/* ── btn-assist (fixed) ── */}
      <button
        type="button"
        className="home-assist-btn"
        onClick={() => {
          setAssistMetricKey(null);
          setAssistOpen(true);
        }}
        aria-label="날씨 지표 안내"
      >
        ?
      </button>

      {/* ── assist 바텀시트 ── */}
      {assistOpen && (
        <div className="home-sheet" role="dialog" aria-modal>
          <button
            type="button"
            className="home-sheet__backdrop"
            onClick={() => setAssistOpen(false)}
          />
          <div className="home-sheet__panel">
            <div className="home-sheet__handle" />
            <strong className="home-sheet__title">
              {assistMetricKey && METRIC_DETAIL[assistMetricKey]
                ? METRIC_DETAIL[assistMetricKey].title
                : "화면 날씨 지표 안내"}
            </strong>
            {assistMetricKey && METRIC_DETAIL[assistMetricKey] ? (
              <p className="home-sheet__metric-help">
                {METRIC_DETAIL[assistMetricKey].text}
              </p>
            ) : (
              <ul className="home-sheet__guide-list">
                <li>
                  <strong>체감기온</strong> 습도·바람을 반영한 실제 느낌
                  온도에요.
                </li>
                <li>
                  <strong>강수확률</strong> 비가 내릴 가능성(24h). 60% 이상이면
                  우산을 챙기세요.
                </li>
                <li>
                  <strong>습도</strong> 60% 이상이면 끈적함, 40% 이하면 건조함을
                  느낄 수 있어요.
                </li>
                <li>
                  <strong>강수량</strong> 하루 강수 총량(mm)이에요.
                </li>
                <li>
                  <strong>바람</strong> 20km/h 이상이면 우산이 뒤집힐 수 있어요.
                </li>
                <li>
                  <strong>자외선</strong> UV 6 이상이면 자외선 차단제가
                  필요해요.
                </li>
                <li>
                  <strong>초미세먼지(PM2.5)</strong> 35㎍/㎥ 이상이면 마스크를
                  착용하세요.
                </li>
                <li>
                  <strong>ggg grade</strong> 날씨 조건 종합 추천 등급이에요.
                </li>
              </ul>
            )}
            <button
              type="button"
              className="home-sheet__close"
              onClick={() => {
                setAssistOpen(false);
                setAssistMetricKey(null);
              }}
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* ── 도시 선택 바텀시트 ── */}
      {cityPickerOpen && (
        <div className="home-sheet" role="dialog" aria-modal>
          <button
            type="button"
            className="home-sheet__backdrop"
            onClick={() => setCityPickerOpen(false)}
          />
          <div className="home-sheet__panel">
            <div className="home-sheet__handle" />
            <strong className="home-sheet__title">도시 선택</strong>
            <CityPicker
              cities={cities}
              cityId={cityId}
              setCityId={(id) => {
                setCityId(id);
                setCitiesPickedByUser(true);
                setCityPickerOpen(false);
              }}
              onUserPick={() => setCitiesPickedByUser(true)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
