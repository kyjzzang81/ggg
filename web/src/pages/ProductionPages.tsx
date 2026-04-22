import { useEffect, useMemo, useRef, useState } from "react";
import { CityPicker } from "../components/CityPicker";
import { NaverNearbyMap } from "../components/NaverNearbyMap";
import { PageStatus } from "../components/PageStatus";
import { ProdField, ProdPageChrome, ProdSection } from "../components/ProdPageChrome";
import { useAuth } from "../hooks/useAuth";
import { useCities } from "../hooks/useCities";
import { syncNearbyPlaces } from "../lib/nearbySync";
import { supabase } from "../lib/supabaseClient";
import { useModeStore } from "../stores/modeStore";
import { PAGE_STATUS_COPY } from "../ui/pageStatus";
import "./pages.css";

type WeekScore = {
  week_of_year: number;
  travel_score: number | null;
  temp_score: number | null;
  rain_score: number | null;
  humidity_score?: number | null;
};

type Monthly = {
  month: number;
  temp_avg: number | null;
  rain_probability: number | null;
  humidity_avg: number | null;
};

function isMissingColumnError(err: { message?: string } | null | undefined) {
  const m = err?.message ?? "";
  return m.toLowerCase().includes("column") && m.includes("does not exist");
}

type NearbyPlace = {
  title: string;
  category: string | null;
  summary: string | null;
  addr: string | null;
  lat: number | null;
  lon: number | null;
  weather_tags: string[] | null;
  mode_tags: string[] | null;
};

type NearbyTab = {
  key: string;
  label: string;
};

function normalizeNearbyCategory(raw: string | null | undefined) {
  const val = (raw ?? "").toLowerCase().trim();
  if (!val) return "기타";
  if (/맛집|음식|food|restaurant|cafe|카페/.test(val)) return "맛집";
  if (/자연|공원|park|trail|hiking|산|숲|해변|beach/.test(val))
    return "자연";
  if (/전시|박물관|museum|gallery|문화|culture|art/.test(val)) return "문화";
  if (/쇼핑|마켓|shopping|store/.test(val)) return "쇼핑";
  if (/체험|activity|놀이|레저|sports|sport/.test(val)) return "액티비티";
  return "기타";
}

function distanceKm(
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

function formatNearbyDistance(km: number | null): string {
  if (km == null || !Number.isFinite(km)) return "거리 정보 준비 중";
  if (km < 1) return `현재 위치에서 약 ${Math.round(km * 1000)}m`;
  return `현재 위치에서 약 ${km.toFixed(1)}km`;
}

function NearbyGsScore({ rank }: { rank: number }) {
  const grade = rank <= 1 ? "강력 추천" : rank === 2 ? "추천" : "보통";
  return (
    <div className="home-gs-score nearby-gs-score" aria-hidden="true">
      <span className="home-gs-score__dots">
        {rank <= 1 ? (
          <>
            <span className="home-gs-score__dot home-ggg-dot--blue" />
            <span className="home-gs-score__dot home-ggg-dot--purple" />
            <span className="home-gs-score__dot home-ggg-dot--green" />
          </>
        ) : rank === 2 ? (
          <>
            <span className="home-gs-score__dot home-ggg-dot--purple" />
            <span className="home-gs-score__dot home-ggg-dot--green" />
          </>
        ) : (
          <span className="home-gs-score__dot home-ggg-dot--green" />
        )}
      </span>
      <span className="home-gs-score__label">{grade}</span>
    </div>
  );
}

function nearbyTabEmoji(label: string): string {
  if (/맛집|카페/.test(label)) return "🍽️";
  if (/자연|공원|산|해변/.test(label)) return "🌿";
  if (/문화|전시/.test(label)) return "🎨";
  if (/쇼핑/.test(label)) return "🛍️";
  if (/액티비티/.test(label)) return "🏃";
  return "📍";
}

function firstCityWithCoords(
  cities: {
    id: string;
    name_ko: string;
    lat: number | null;
    lon: number | null;
  }[],
) {
  const c = cities.find(
    (row) =>
      row.lat != null &&
      row.lon != null &&
      Number.isFinite(row.lat) &&
      Number.isFinite(row.lon),
  );
  if (!c) return null;
  return {
    id: c.id,
    name_ko: c.name_ko,
    lat: c.lat as number,
    lon: c.lon as number,
  };
}

function NearbyLoadingSkeleton() {
  return (
    <>
      <section className="home-hero nearby-hero nearby-skeleton" aria-hidden="true">
        <div className="nearby-skeleton__brand" />
        <div className="nearby-skeleton__title" />
        <div className="nearby-skeleton__title nearby-skeleton__title--short" />
        <div className="nearby-skeleton__desc" />
      </section>
      <section className="home-section nearby-section nearby-skeleton" aria-hidden="true">
        <div className="nearby-skeleton__tabs" />
        <div className="nearby-skeleton__card" />
        <div className="nearby-skeleton__card" />
        <div className="nearby-skeleton__card" />
      </section>
      <section className="home-section nearby-section nearby-skeleton" aria-hidden="true">
        <div className="nearby-skeleton__map-title" />
        <div className="nearby-skeleton__map" />
      </section>
    </>
  );
}

type ScoreViewMode = "month" | "week" | "day";
type TravelType = "romantic" | "family" | "adventure";
type TravelCategory = {
  key: TravelType;
  icon: string;
  label: string;
  activity: "city_sightseeing" | "beach" | "hiking";
  reasonPrefix: string;
};

function dayOfYearToDate(dayOfYear: number) {
  const year = new Date().getFullYear();
  const base = new Date(Date.UTC(year, 0, 1));
  base.setUTCDate(dayOfYear);
  return base;
}

function weekToRange(weekOfYear: number) {
  const year = new Date().getFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const start = new Date(jan1);
  start.setUTCDate(jan1.getUTCDate() + (weekOfYear - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { start, end };
}

function getDayOfYear(date: Date) {
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86400000) + 1;
}

function formatWeekRangeLabel(weekOfYear: number) {
  const range = weekToRange(weekOfYear);
  const sm = range.start.getUTCMonth() + 1;
  const sd = range.start.getUTCDate();
  const em = range.end.getUTCMonth() + 1;
  const ed = range.end.getUTCDate();
  return `${sm}/${sd} - ${em}/${ed}`;
}

export function ScoreProdPage() {
  const { cities, cityId, setCityId, citiesLoading, citiesError } = useCities();
  const { couple, family } = useModeStore();
  const [weeks, setWeeks] = useState<WeekScore[]>([]);
  const [activityRows, setActivityRows] = useState<
    { day_of_year: number; score: number }[]
  >([]);
  const [viewMode] = useState<ScoreViewMode>("month");
  const [selectedMonth, setSelectedMonth] = useState<number>(
    new Date().getMonth() + 1,
  );
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedDateIso, setSelectedDateIso] = useState<string | null>(null);
  const [travelType, setTravelType] = useState<TravelType>("romantic");
  const [ddayOpen, setDdayOpen] = useState(false);
  const [cityConfirmed, setCityConfirmed] = useState(false);
  const [viewScoreReady, setViewScoreReady] = useState(false);
  const [closingSheet, setClosingSheet] = useState<"score" | "dday" | null>(
    null,
  );
  const [cityQuery, setCityQuery] = useState("");
  const [showCityResults, setShowCityResults] = useState(false);
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showLoadingSkeleton, setShowLoadingSkeleton] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const activeCityId = cityConfirmed ? cityId : "";
  const calendarSectionRef = useRef<HTMLElement | null>(null);
  const loadingStartedAtRef = useRef(0);

  const selectCityAndAdvance = (nextCityId: string, nextCityName: string) => {
    setCityId(nextCityId);
    setCityQuery(nextCityName);
    setCityConfirmed(true);
    setShowCityResults(false);
  };
  const closeSheet = (sheet: "score" | "dday") => {
    setClosingSheet(sheet);
    window.setTimeout(() => {
      if (sheet === "score") setViewScoreReady(false);
      if (sheet === "dday") setDdayOpen(false);
      setClosingSheet(null);
    }, 220);
  };

  const selectedCity = useMemo(
    () => cities.find((c) => c.id === cityId) ?? null,
    [cities, cityId],
  );
  const featuredCities = useMemo(() => cities.slice(0, 6), [cities]);
  const travelCategories = useMemo<TravelCategory[]>(() => {
    const city = selectedCity?.name_ko ?? "";
    if (/(제주|부산|강릉|여수)/.test(city)) {
      return [
        {
          key: "romantic",
          icon: "💕",
          label: "감성 여행",
          activity: "city_sightseeing",
          reasonPrefix: "야외 산책/오션뷰 일정에 잘 맞아요.",
        },
        {
          key: "family",
          icon: "🏖️",
          label: "가족 물놀이",
          activity: "beach",
          reasonPrefix: "아이 동반 이동이 비교적 편안한 구간이에요.",
        },
        {
          key: "adventure",
          icon: "🥾",
          label: "아웃도어",
          activity: "hiking",
          reasonPrefix: "활동량 높은 코스에도 날씨 리스크가 낮아요.",
        },
      ];
    }
    return [
      {
        key: "romantic",
        icon: "💕",
        label: "연인 여행",
        activity: "city_sightseeing",
        reasonPrefix: "도보/야외 데이트 일정이 편안해요.",
      },
      {
        key: "family",
        icon: "👨‍👩‍👧",
        label: "가족 여행",
        activity: "beach",
        reasonPrefix: "아이 동반 이동 부담이 적은 구간이에요.",
      },
      {
        key: "adventure",
        icon: "🥾",
        label: "액티비티",
        activity: "hiking",
        reasonPrefix: "강수/바람 변동이 적어 야외 활동에 유리해요.",
      },
    ];
  }, [selectedCity?.name_ko]);
  const selectedCategory =
    travelCategories.find((c) => c.key === travelType) ?? travelCategories[0];

  useEffect(() => {
    if (!supabase || !activeCityId) {
      setWeeks([]);
      setActivityRows([]);
      setErr(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setShowLoadingSkeleton(true);
    loadingStartedAtRef.current = Date.now();
    setErr(null);

    void (async () => {
      try {
        const [w, a] = await Promise.all([
          supabase
            .from("best_travel_week")
            .select(
              "week_of_year, travel_score, temp_score, rain_score, humidity_score",
            )
            .eq("city_id", activeCityId)
            .order("travel_score", { ascending: false })
            .limit(16),
          supabase
            .from("activity_weather_score")
            .select("day_of_year, score")
            .eq("city_id", activeCityId)
            .eq("activity", selectedCategory.activity)
            .order("day_of_year", { ascending: true })
            .limit(366),
        ]);

        const wErr = w.error?.message ?? null;
        const aErr = a.error?.message ?? null;
        if (wErr || aErr) setErr(PAGE_STATUS_COPY.error);
        setWeeks((w.data ?? []) as WeekScore[]);
        setActivityRows(
          (a.data ?? []) as { day_of_year: number; score: number }[],
        );
      } catch {
        setErr(PAGE_STATUS_COPY.error);
      } finally {
        setLoading(false);
        const elapsed = Date.now() - loadingStartedAtRef.current;
        const remaining = Math.max(0, 420 - elapsed);
        window.setTimeout(() => {
          setShowLoadingSkeleton(false);
        }, remaining);
      }
    })();
  }, [activeCityId, selectedCategory.activity]);

  const filteredCities = useMemo(() => {
    const q = cityQuery.trim().toLowerCase();
    if (!q) return [];
    return cities
      .filter((c) => c.name_ko.toLowerCase().includes(q))
      .slice(0, 8);
  }, [cityQuery, cities]);
  const modeText =
    couple && family ? "연인+가족" : couple ? "연인" : family ? "가족" : "기본";

  useEffect(() => {
    setViewScoreReady(false);
    setDdayOpen(false);
    setSelectedDateIso(null);
    setSelectedDay(null);
  }, [cityId]);

  useEffect(() => {
    if (!cityConfirmed) return;
    const t = window.setTimeout(() => {
      const top = calendarSectionRef.current?.getBoundingClientRect().top ?? 0;
      const y = window.scrollY + top - 88;
      window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    }, 40);
    return () => window.clearTimeout(t);
  }, [cityConfirmed]);

  const weekCells = useMemo(
    () =>
      weeks.slice(0, 12).map((row) => ({
        key: `w-${row.week_of_year}`,
        label: `${row.week_of_year}주`,
        score: Math.round((row.travel_score ?? 0) * 100),
        picked: row.week_of_year === selectedWeek,
      })),
    [weeks, selectedWeek],
  );

  const dayCells = useMemo(
    () =>
      activityRows.slice(0, 14).map((row) => ({
        key: `d-${row.day_of_year}`,
        label: `${dayOfYearToDate(row.day_of_year).getUTCMonth() + 1}/${dayOfYearToDate(row.day_of_year).getUTCDate()}`,
        score: Math.round((row.score ?? 0) * 100),
        picked: row.day_of_year === selectedDay,
      })),
    [activityRows, selectedDay],
  );

  const monthCalendarRows = useMemo(() => {
    const year = new Date().getFullYear();
    const first = new Date(year, selectedMonth - 1, 1);
    const lastDate = new Date(year, selectedMonth, 0).getDate();
    const firstWeekday = first.getDay();
    const scoreMap = new Map(
      activityRows.map((r) => [
        r.day_of_year,
        Math.round((r.score ?? 0) * 100),
      ]),
    );
    const cells: Array<{
      day: number;
      score: number | null;
      kind: "good" | "normal" | "bad" | "empty";
    }> = [];

    for (let i = 0; i < firstWeekday; i += 1) {
      cells.push({ day: 0, score: null, kind: "empty" });
    }
    for (let day = 1; day <= lastDate; day += 1) {
      const doy = getDayOfYear(new Date(year, selectedMonth - 1, day));
      const score = scoreMap.get(doy) ?? null;
      const kind =
        score == null
          ? "normal"
          : score >= 70
            ? "good"
            : score >= 45
              ? "normal"
              : "bad";
      cells.push({ day, score, kind });
    }
    while (cells.length % 7 !== 0)
      cells.push({ day: 0, score: null, kind: "empty" });

    const rows: Array<{
      weekNo: number;
      weekLabel: "추천" | "보통" | "비추천";
      days: Array<{
        day: number;
        score: number | null;
        kind: "good" | "normal" | "bad" | "empty";
      }>;
    }> = [];
    for (let i = 0; i < cells.length; i += 7) {
      const days = cells.slice(i, i + 7);
      const weekScores = days
        .map((d) => d.score)
        .filter((v): v is number => typeof v === "number");
      const avg = weekScores.length
        ? weekScores.reduce((a, b) => a + b, 0) / weekScores.length
        : 55;
      const weekLabel = avg >= 70 ? "추천" : avg >= 45 ? "보통" : "비추천";
      rows.push({ weekNo: i / 7 + 1, weekLabel, days });
    }
    return rows;
  }, [activityRows, selectedMonth]);

  const monthScoreBars = useMemo(() => {
    const year = new Date().getFullYear();
    const monthBuckets = Array.from({ length: 12 }, () => [] as number[]);
    for (const row of activityRows) {
      const date = new Date(year, 0, 1);
      date.setDate(row.day_of_year);
      const month = date.getMonth();
      monthBuckets[month].push(Math.round((row.score ?? 0) * 100));
    }
    return monthBuckets.map((scores, idx) => {
      const avg = scores.length
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;
      const kind = avg >= 70 ? "good" : avg >= 45 ? "normal" : "bad";
      return { month: idx + 1, score: avg, kind };
    });
  }, [activityRows]);

  const recommendationRows = useMemo(() => {
    return weeks.slice(0, 5).map((w) => ({
      id: w.week_of_year,
      title: formatWeekRangeLabel(w.week_of_year),
      weekLabel: `${w.week_of_year}주차`,
      reason: selectedCategory.reasonPrefix,
      score: Math.round((w.travel_score ?? 0) * 100),
      grade:
        Math.round((w.travel_score ?? 0) * 100) >= 75
          ? "추천"
          : Math.round((w.travel_score ?? 0) * 100) >= 50
            ? "보통"
            : "주의",
    }));
  }, [selectedCategory, weeks]);

  if (!supabase) {
    return (
      <article className="score-page">
        <PageStatus
          variant="error"
          message={PAGE_STATUS_COPY.supabaseMissing}
        />
      </article>
    );
  }

  return (
    <article className="score-page">
      {citiesError ? <PageStatus variant="error" /> : null}

      {err ? <PageStatus variant="error" /> : null}

      {citiesLoading ? <ScoreEntrySkeleton /> : null}

      {!citiesLoading && !citiesError ? (
        <section
          className={`score-city-section ${cityConfirmed ? "is-compact" : ""}`}
        >
          <div className="score-city-question">
            <input
              type="text"
              className="score-city-question__field"
              value={cityQuery}
              placeholder="도시명을 입력해 주세요"
              onFocus={() => setShowCityResults(true)}
              onChange={(e) => {
                setCityQuery(e.target.value);
                setShowCityResults(true);
              }}
            />
            {showCityResults && filteredCities.length ? (
              <div
                className="score-city-results"
                role="listbox"
                aria-label="검색된 도시 목록"
              >
                {filteredCities.map((city) => (
                  <button
                    key={city.id}
                    type="button"
                    className="score-city-results__item"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectCityAndAdvance(city.id, city.name_ko);
                    }}
                  >
                    <strong>{city.name_ko}</strong>
                    <span>{city.id}</span>
                  </button>
                ))}
              </div>
            ) : showCityResults && cityQuery.trim() ? (
              <button
                type="button"
                className="score-city-request-btn"
                onClick={() => {
                  window.location.href = "/mission";
                }}
              >
                새로운 도시 스코어 요청하기
              </button>
            ) : null}
          </div>

          <div className="score-featured-panel">
            <p className="score-featured-panel__title">👋 이주의 추천 도시</p>
            <div className="score-featured-cities">
              {featuredCities.slice(0, 4).map((city) => (
                <button
                  key={city.id}
                  type="button"
                  className={
                    city.id === cityId && cityConfirmed ? "is-active" : ""
                  }
                  onClick={() => {
                    selectCityAndAdvance(city.id, city.name_ko);
                  }}
                >
                  <strong>{city.name_ko}</strong>
                  <span>추천 도시</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {cityConfirmed ? (
        <section ref={calendarSectionRef} className="prod-section score-flow">
          {showLoadingSkeleton ? (
            <ScoreLoadingSkeleton />
          ) : (
            <>
              {viewMode === "month" ? (
                <div className="score-month-calendar">
                  <div className="score-month-calendar__head">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedMonth((prev) => (prev <= 1 ? 12 : prev - 1))
                      }
                    >
                      &#8249;
                    </button>
                    <strong>
                      {new Date().getFullYear()}년 {selectedMonth}월
                    </strong>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedMonth((prev) => (prev >= 12 ? 1 : prev + 1))
                      }
                    >
                      &#8250;
                    </button>
                  </div>
                  <div className="score-month-calendar__legend">
                    <span className="is-good">추천</span>
                    <span className="is-normal">보통</span>
                    <span className="is-bad">비추천</span>
                  </div>
                  <div className="score-month-calendar__weekday">
                    <span>일</span>
                    <span>월</span>
                    <span>화</span>
                    <span>수</span>
                    <span>목</span>
                    <span>금</span>
                    <span>토</span>
                  </div>
                  <div className="score-month-calendar__body">
                    {monthCalendarRows.map((week) => (
                      <div
                        key={week.weekNo}
                        className="score-month-calendar__week"
                      >
                        <div className="score-month-calendar__week-label">
                          {week.weekNo}주차 · {week.weekLabel}
                        </div>
                        <div className="score-month-calendar__days">
                          {week.days.map((cell, dayIdx) => (
                            <button
                              key={`${week.weekNo}-${dayIdx}`}
                              type="button"
                              className={`score-month-calendar__day ${cell.kind} ${selectedDay === cell.day ? "is-picked" : ""}`}
                              disabled={cell.day === 0}
                              onClick={() => {
                                if (cell.day <= 0) return;
                                setSelectedDay(cell.day);
                                const y = new Date().getFullYear();
                                const iso = `${y}-${String(selectedMonth).padStart(2, "0")}-${String(cell.day).padStart(2, "0")}`;
                                setSelectedDateIso(iso);
                              }}
                            >
                              {cell.day > 0 ? (
                                <>
                                  <span className="score-month-calendar__day-label">
                                    {cell.kind === "good"
                                      ? "추천"
                                      : cell.kind === "bad"
                                        ? "비추천"
                                        : "보통"}
                                  </span>
                                  <strong>{cell.day}</strong>
                                </>
                              ) : (
                                ""
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="score-calendar-grid">
                  {(viewMode === "week" ? weekCells : dayCells).map((cell) => (
                    <button
                      key={cell.key}
                      type="button"
                      className={`score-calendar-cell ${cell.picked ? "is-picked" : ""}`}
                      onClick={() => {
                        if (viewMode === "week")
                          setSelectedWeek(Number(cell.key.replace("w-", "")));
                        if (viewMode === "day")
                          setSelectedDay(Number(cell.key.replace("d-", "")));
                      }}
                    >
                      <span>{cell.label}</span>
                      <strong>
                        {Number.isFinite(cell.score) ? cell.score : 0}
                      </strong>
                    </button>
                  ))}
                </div>
              )}
              {viewMode === "month" ? (
                <div className="score-month-bars">
                  <h3 className="score-month-bars__title">Monthly ggg Score</h3>
                  <div className="score-month-bars__chart">
                    {monthScoreBars.map((bar) => (
                      <button
                        key={bar.month}
                        type="button"
                        className={`score-month-bars__bar ${bar.kind} ${selectedMonth === bar.month ? "is-active" : ""}`}
                        style={{
                          height: `${Math.max(24, (bar.score / 100) * 88)}px`,
                        }}
                        onClick={() => setSelectedMonth(bar.month)}
                      >
                        <span>{bar.month}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}
          <div className="score-view-actions">
            <button
              type="button"
              className="page-btn page-btn--primary score-cta"
              disabled={loading || showLoadingSkeleton}
              onClick={() => setViewScoreReady(true)}
            >
              view Score
            </button>
          </div>
        </section>
      ) : null}

      {cityConfirmed && (viewScoreReady || closingSheet === "score") ? (
        <div
          className={`home-sheet${closingSheet === "score" ? " is-closing" : ""}`}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="home-sheet__backdrop"
            onClick={() => closeSheet("score")}
          />
          <div className="home-sheet__panel">
            <div className="home-sheet__handle" />
            <section className="score-section" style={{ marginTop: "0.5rem" }}>
              <div className="score-context">
                <p>
                  <strong>{selectedCity?.name_ko ?? "선택 도시"}</strong> · 모드{" "}
                  <strong>{modeText}</strong> 기준으로
                  {viewMode === "month"
                    ? ` ${selectedMonth}월`
                    : viewMode === "week"
                      ? ` ${selectedWeek ?? "-"}주차`
                      : ` 일별 구간`}
                  의 데이터 해석을 보여줍니다.
                </p>
                <p className="page-muted">
                  강수/온도/습도 점수를 가중치로 계산하며, 모드에 따라 추천
                  문구와 우선순위가 달라집니다.
                </p>
              </div>
            </section>

            <section className="score-section">
              <div className="score-view-tabs">
                {travelCategories.map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    className={travelType === cat.key ? "is-active" : ""}
                    onClick={() => setTravelType(cat.key)}
                  >
                    <span className="score-tab-icon" aria-hidden="true">
                      {cat.icon}
                    </span>{" "}
                    {cat.label}
                  </button>
                ))}
              </div>
              {!loading && !err && recommendationRows.length === 0 ? (
                <PageStatus variant="empty" />
              ) : null}
              {!loading && !err && recommendationRows.length ? (
                <ul className="page-list score-reco-list">
                  {recommendationRows.map((row) => (
                    <li key={row.id}>
                      <strong>
                        <span className="score-reco-list__range">
                          {row.title}
                        </span>
                      </strong>
                      <span className="score-reco-list__meta">
                        <span className="score-reco-list__meta-item">
                          <span aria-hidden="true">📌</span> {row.reason}
                        </span>
                        <span
                          className={`score-reco-list__grade score-reco-list__grade--${row.grade === "추천" ? "good" : row.grade === "보통" ? "normal" : "warn"}`}
                        >
                          {row.grade}
                        </span>
                      </span>
                      <span className="score-reco-list__score">
                        <span className="home-gs-score" aria-hidden="true">
                          <span className="home-gs-score__dots">
                            <span className="home-gs-score__dot home-ggg-dot--green" />
                            <span className="home-gs-score__dot home-ggg-dot--purple" />
                            <span className="home-gs-score__dot home-ggg-dot--blue" />
                          </span>
                        </span>
                        {/* <span>추천도 {row.score}</span> */}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>

            <button
              type="button"
              className="page-btn page-btn--primary score-cta"
              disabled={!selectedDateIso}
              onClick={() => setDdayOpen(true)}
            >
              {selectedDateIso ? "D-day로 저장" : "날짜를 먼저 선택해 주세요"}
            </button>
            <button
              type="button"
              className="home-sheet__close"
              onClick={() => closeSheet("score")}
            >
              닫기
            </button>
          </div>
        </div>
      ) : null}

      {ddayOpen || closingSheet === "dday" ? (
        <div
          className={`home-sheet${closingSheet === "dday" ? " is-closing" : ""}`}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="home-sheet__backdrop"
            onClick={() => closeSheet("dday")}
          />
          <div className="home-sheet__panel">
            <div className="home-sheet__handle" />
            <h3 className="home-sheet__title">D-day 저장</h3>
            <p className="home-sheet__text">
              {selectedCity?.name_ko ?? "선택 도시"} /{" "}
              {viewMode === "month"
                ? selectedDateIso ?? `${selectedMonth}월`
                : viewMode === "week"
                  ? `${selectedWeek ?? "-"}주차 (${selectedWeek ? `${weekToRange(selectedWeek).start.toISOString().slice(5, 10)}~${weekToRange(selectedWeek).end.toISOString().slice(5, 10)}` : "-"})`
                  : selectedDay
                    ? `${dayOfYearToDate(selectedDay).toISOString().slice(5, 10)}`
                    : "일별"}{" "}
              조건으로 D-day를 저장합니다.
            </p>
            {user ? (
              <a
                href="/dday"
                className="page-btn page-btn--primary"
                style={{ width: "100%", textAlign: "center" }}
              >
                저장 계속하기
              </a>
            ) : (
              <p className="page-muted">
                저장하려면 먼저 로그인해 주세요. `/dday` 화면에서 바로 이어서
                등록할 수 있어요.
              </p>
            )}
            <button
              type="button"
              className="home-sheet__close"
              onClick={() => closeSheet("dday")}
            >
              닫기
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function ScoreLoadingSkeleton() {
  return (
    <div className="score-skeleton" aria-hidden="true">
      <div className="score-skeleton__tabs" />
      <div className="score-skeleton__grid">
        {Array.from({ length: 12 }).map((_, idx) => (
          <div key={idx} className="score-skeleton__cell" />
        ))}
      </div>
      <div className="score-skeleton__cta" />
    </div>
  );
}

function ScoreEntrySkeleton() {
  return (
    <section className="score-city-section" aria-hidden="true">
      <div className="score-city-question">
        <div className="score-entry-skeleton__question" />
        <div className="score-entry-skeleton__field" />
      </div>
      <div className="score-featured-panel">
        <div className="score-entry-skeleton__title" />
        <div className="score-entry-skeleton__cards">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="score-entry-skeleton__card" />
          ))}
        </div>
      </div>
    </section>
  );
}

export function PlaceProdPage() {
  const { cities, cityId, setCityId, citiesLoading, citiesError } = useCities();
  const [activity, setActivity] = useState("beach");
  const [rows, setRows] = useState<{ day_of_year: number; score: number }[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !cityId) {
      setRows([]);
      setErr(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr(null);

    void (async () => {
      try {
        const { data, error } = await supabase
          .from("activity_weather_score")
          .select("day_of_year, score")
          .eq("city_id", cityId)
          .eq("activity", activity)
          .order("score", { ascending: false })
          .limit(12);

        if (error) setErr(PAGE_STATUS_COPY.error);
        setRows((data ?? []) as { day_of_year: number; score: number }[]);
      } catch {
        setErr(PAGE_STATUS_COPY.error);
      } finally {
        setLoading(false);
      }
    })();
  }, [activity, cityId]);

  if (!supabase) {
    return (
      <ProdPageChrome
        title="장소 추천"
        lead="목적에 맞는 날씨 적합도로 여행 타이밍을 고릅니다."
      >
        <PageStatus
          variant="error"
          message={PAGE_STATUS_COPY.supabaseMissing}
        />
      </ProdPageChrome>
    );
  }

  return (
    <ProdPageChrome
      title="장소 추천"
      lead="목적에 맞는 날씨 적합도로 여행 타이밍을 고릅니다."
    >
      {citiesLoading ? <PageStatus variant="loading" /> : null}
      {citiesError ? <PageStatus variant="error" /> : null}

      {!citiesLoading && !citiesError ? (
        <CityPicker cities={cities} cityId={cityId} setCityId={setCityId} />
      ) : null}

      <ProdField label="활동">
        <select
          className="page-select"
          value={activity}
          onChange={(e) => setActivity(e.target.value)}
        >
          <option value="beach">해변</option>
          <option value="hiking">하이킹</option>
          <option value="city_sightseeing">도시관광</option>
        </select>
      </ProdField>

      {err ? <PageStatus variant="error" /> : null}
      {loading ? <PageStatus variant="loading" /> : null}

      <ProdSection title="추천 상위 날짜(평년 기준)">
        {!loading && !err && rows.length === 0 ? (
          <PageStatus variant="empty" />
        ) : null}
        {!loading && !err && rows.length ? (
          <ul className="page-list">
            {rows.map((r) => (
              <li key={r.day_of_year}>
                <strong>{r.day_of_year}일차</strong>
                <span className="page-muted">적합도 {r.score.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </ProdSection>
    </ProdPageChrome>
  );
}

export function NearbyProdPage() {
  const naverMapClientId =
    import.meta.env.VITE_NAVER_MAP_CLIENT_ID?.trim() ?? "";
  const { cities, cityId, setCityId, citiesLoading, citiesError } = useCities(
    500,
    "nearby:last-city-id",
  );
  const [nearest, setNearest] = useState<{
    id: string;
    name_ko: string;
    lat: number;
    lon: number;
  } | null>(null);
  const [userCoords, setUserCoords] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [geoState, setGeoState] = useState<
    "pending" | "ok" | "unavailable" | "denied"
  >("pending");
  const [places, setPlaces] = useState<
    NearbyPlace[]
  >([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesErr, setPlacesErr] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<string>("전체");
  const [selectedPlaceTitle, setSelectedPlaceTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!cities.length || typeof navigator === "undefined") {
      const fallback = firstCityWithCoords(cities);
      if (fallback && !cityId) {
        setNearest(fallback);
        setCityId(fallback.id);
      }
      setGeoState(cities.length ? "unavailable" : "pending");
      return;
    }
    if (!navigator.geolocation) {
      const fallback = firstCityWithCoords(cities);
      if (fallback) {
        setNearest(fallback);
        if (!cityId) setCityId(fallback.id);
      }
      setGeoState("unavailable");
      return;
    }

    setGeoState("pending");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserCoords({ lat: latitude, lon: longitude });
        let best: {
          id: string;
          name_ko: string;
          lat: number;
          lon: number;
        } | null = null;
        let d = Infinity;
        for (const c of cities) {
          if (c.lat == null || c.lon == null) continue;
          const dx = (latitude - c.lat) ** 2 + (longitude - c.lon) ** 2;
          if (dx < d) {
            d = dx;
            best = { id: c.id, name_ko: c.name_ko, lat: c.lat, lon: c.lon };
          }
        }
        const fallbackCity = best
          ? best
          : (() => {
              const firstWithCoords = cities.find(
                (c) =>
                  c.lat != null &&
                  c.lon != null &&
                  Number.isFinite(c.lat) &&
                  Number.isFinite(c.lon),
              );
              return firstWithCoords
                ? {
                    id: firstWithCoords.id,
                    name_ko: firstWithCoords.name_ko,
                    lat: firstWithCoords.lat as number,
                    lon: firstWithCoords.lon as number,
                  }
                : null;
            })();
        setNearest(fallbackCity);
        if (fallbackCity) {
          setCityId(fallbackCity.id);
        }
        setGeoState("ok");
      },
      () => {
        setUserCoords(null);
        const fallback = firstCityWithCoords(cities);
        if (fallback) {
          setNearest(fallback);
          if (!cityId) setCityId(fallback.id);
        }
        setGeoState("denied");
      },
      { enableHighAccuracy: false, maximumAge: 120_000, timeout: 12_000 },
    );
  }, [cities, cityId, setCityId]);

  const mapCenter = useMemo(() => {
    if (userCoords) return userCoords;
    if (nearest) return { lat: nearest.lat, lon: nearest.lon };
    const c = cities.find((x) => x.id === cityId);
    if (
      c?.lat != null &&
      c?.lon != null &&
      Number.isFinite(c.lat) &&
      Number.isFinite(c.lon)
    ) {
      return { lat: c.lat, lon: c.lon };
    }
    return null;
  }, [userCoords, nearest, cities, cityId]);

  const mapMarkers = useMemo(
    () =>
      places
        .filter(
          (p) =>
            p.lat != null &&
            p.lon != null &&
            Number.isFinite(p.lat) &&
            Number.isFinite(p.lon),
        )
        .map((p) => ({
          lat: p.lat as number,
          lng: p.lon as number,
          title: p.title,
        })),
    [places],
  );

  const placeTabs = useMemo<NearbyTab[]>(() => {
    const labels = Array.from(
      new Set(places.map((p) => normalizeNearbyCategory(p.category))),
    );
    return [{ key: "전체", label: "전체" }, ...labels.map((label) => ({ key: label, label }))];
  }, [places]);

  useEffect(() => {
    if (!placeTabs.some((tab) => tab.key === selectedTab)) {
      setSelectedTab("전체");
    }
  }, [placeTabs, selectedTab]);

  const visiblePlaces = useMemo(() => {
    const base =
      selectedTab === "전체"
        ? places
        : places.filter(
            (p) => normalizeNearbyCategory(p.category) === selectedTab,
          );
    return base.slice(0, 12);
  }, [places, selectedTab]);

  useEffect(() => {
    if (!visiblePlaces.some((p) => p.title === selectedPlaceTitle)) {
      setSelectedPlaceTitle(visiblePlaces[0]?.title ?? null);
    }
  }, [selectedPlaceTitle, visiblePlaces]);

  useEffect(() => {
    if (!supabase || !cityId) {
      setPlaces([]);
      setPlacesErr(null);
      setPlacesLoading(false);
      return;
    }

    setPlacesLoading(true);
    setPlacesErr(null);

    void (async () => {
      try {
        const full = await supabase
          .from("nearby_places")
          .select(
            "title, category, summary, addr, lat, lon, weather_tags, mode_tags",
          )
          .eq("city_id", cityId)
          .order("cached_at", { ascending: false })
          .limit(24);

        if (full.error && isMissingColumnError(full.error)) {
          const basic = await supabase
            .from("nearby_places")
            .select("title, addr")
            .eq("city_id", cityId)
            .order("cached_at", { ascending: false })
            .limit(12);
          if (basic.error) {
            setPlacesErr(PAGE_STATUS_COPY.error);
            setPlaces([]);
          } else {
            setPlacesErr(null);
            setPlaces(
              (basic.data ?? []).map((row) => ({
                title: row.title,
                category: null,
                summary: null,
                addr: row.addr,
                lat: null,
                lon: null,
                weather_tags: null,
                mode_tags: null,
              })),
            );
          }
          return;
        }

        if (full.error) {
          setPlacesErr(PAGE_STATUS_COPY.error);
          setPlaces([]);
          return;
        }

        let nextPlaces = (full.data ?? []) as NearbyPlace[];
        let nextErr: string | null = null;
        if (nextPlaces.length === 0) {
          const sync = await syncNearbyPlaces(cityId);
          if (!sync.ok) {
            nextErr = sync.error ?? PAGE_STATUS_COPY.error;
          } else {
            const retry = await supabase
              .from("nearby_places")
              .select(
                "title, category, summary, addr, lat, lon, weather_tags, mode_tags",
              )
              .eq("city_id", cityId)
              .order("cached_at", { ascending: false })
              .limit(24);
            if (retry.error) nextErr = retry.error.message;
            else nextPlaces = (retry.data ?? []) as NearbyPlace[];
          }
        }
        setPlacesErr(nextErr);
        setPlaces(nextPlaces);
      } catch {
        setPlacesErr(PAGE_STATUS_COPY.error);
        setPlaces([]);
      } finally {
        setPlacesLoading(false);
      }
    })();
  }, [cityId]);

  const selectedCityName = cities.find((c) => c.id === cityId)?.name_ko ?? "";
  const showNearbySkeleton = citiesLoading || (placesLoading && places.length === 0);

  if (!supabase) {
    return (
      <article className="home-page nearby-page">
        <PageStatus
          variant="error"
          message={PAGE_STATUS_COPY.supabaseMissing}
        />
      </article>
    );
  }

  if (showNearbySkeleton && !citiesError) {
    return (
      <article className="home-page nearby-page">
        <NearbyLoadingSkeleton />
      </article>
    );
  }

  return (
    <article className="home-page nearby-page">
      <section className="home-hero nearby-hero">
        <div className="nearby-hero__brand">
          <span className="home-ggg-dots" aria-hidden="true">
            <span className="home-ggg-dot home-ggg-dot--green" />
            <span className="home-ggg-dot home-ggg-dot--purple" />
            <span className="home-ggg-dot home-ggg-dot--blue" />
          </span>
          <strong>near by</strong>
        </div>
        <h2 className="nearby-hero__title">
          <span>{selectedCityName || nearest?.name_ko || "근처"}에서</span>
          <br />
          지금 뭐하면 좋을까?
        </h2>
        <p className="nearby-hero__desc">
          오늘 {selectedCityName || nearest?.name_ko || "이 지역"}의 날씨를 반영해
          지금 가기 좋은 장소를 추천해요.
        </p>
        {citiesError ? <PageStatus variant="error" /> : null}
      </section>

      <section className="home-section nearby-section">
        {geoState === "pending" ? (
          <PageStatus variant="loading" message="위치를 확인하는 중이에요." />
        ) : null}
        {geoState === "unavailable" ? (
          <PageStatus
            variant="empty"
            message="이 환경에서는 위치를 쓸 수 없어요. 도시를 직접 선택해 주세요."
          />
        ) : null}
        {geoState === "denied" ? (
          <PageStatus
            variant="empty"
            message="위치 권한이 꺼져 있어요. 설정에서 위치 허용 시 자동으로 가까운 도시를 맞춰요."
          />
        ) : null}

        <h3 className="home-section__title">주변 추천</h3>
        {placesErr ? <PageStatus variant="error" /> : null}
        {!placesLoading && !placesErr && places.length === 0 ? (
          <PageStatus
            variant="empty"
            message="주변 추천 데이터가 아직 없어요. 잠시 후 다시 시도해 주세요."
          />
        ) : null}

        {!placesLoading && !placesErr && places.length ? (
          <>
            <div className="nearby-activity-tabs" role="tablist" aria-label="추천 활동 탭">
              {placeTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={selectedTab === tab.key}
                  className={selectedTab === tab.key ? "is-active" : ""}
                  onClick={() => setSelectedTab(tab.key)}
                >
                  <span aria-hidden="true">{nearbyTabEmoji(tab.label)}</span>{" "}
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="home-place-list nearby-place-list">
              {visiblePlaces.slice(0, 3).map((place, idx) => {
                const km =
                  mapCenter &&
                  place.lat != null &&
                  place.lon != null &&
                  Number.isFinite(place.lat) &&
                  Number.isFinite(place.lon)
                    ? distanceKm(mapCenter.lat, mapCenter.lon, place.lat, place.lon)
                    : null;
                const active = selectedPlaceTitle === place.title;
                return (
                  <button
                    key={`${place.title}-${idx}`}
                    type="button"
                    className={`home-place-card nearby-place-card ${active ? "is-active" : ""}`}
                    onClick={() => setSelectedPlaceTitle(place.title)}
                  >
                    <div className="home-place-card__body">
                      <div className="home-place-card__head">
                        <h3 className="home-place-card__name">{place.title}</h3>
                        <p className="home-place-card__desc">
                          {place.summary?.trim() || "장소에 대한 1줄 설명"}
                        </p>
                      </div>
                      <div className="home-place-card__map-row">
                        <span className="nearby-place-card__category">
                          {normalizeNearbyCategory(place.category)}
                        </span>
                        <span className="home-place-card__dist">
                          {formatNearbyDistance(km)}
                        </span>
                      </div>
                    </div>
                    <NearbyGsScore rank={idx + 1} />
                  </button>
                );
              })}
            </div>
          </>
        ) : null}
      </section>

      <section className="home-section nearby-section">
        <h3 className="home-section__title">지도</h3>
        {mapCenter ? (
          naverMapClientId ? (
            <NaverNearbyMap
              clientId={naverMapClientId}
              center={mapCenter}
              markers={mapMarkers}
              selectedMarkerTitle={selectedPlaceTitle}
            />
          ) : (
            <PageStatus
              variant="empty"
              message="네이버 지도를 보려면 VITE_NAVER_MAP_CLIENT_ID 설정 후 서버를 재시작해 주세요."
            />
          )
        ) : (
          <PageStatus variant="loading" message="지도 좌표를 준비 중이에요." />
        )}
      </section>
    </article>
  );
}

export function HiddenSeasonProdPage() {
  const { cities, cityId, setCityId, citiesLoading, citiesError } = useCities();
  const [rows, setRows] = useState<WeekScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !cityId) {
      setRows([]);
      setErr(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr(null);

    void (async () => {
      try {
        const { data, error } = await supabase
          .from("best_travel_week")
          .select("week_of_year, travel_score, temp_score, rain_score")
          .eq("city_id", cityId)
          .order("travel_score", { ascending: false })
          .limit(12);

        if (error) setErr(PAGE_STATUS_COPY.error);
        setRows((data ?? []) as WeekScore[]);
      } catch {
        setErr(PAGE_STATUS_COPY.error);
      } finally {
        setLoading(false);
      }
    })();
  }, [cityId]);

  if (!supabase) {
    return (
      <ProdPageChrome
        title="숨은 황금 시즌"
        lead="점수가 높은 주차를 빠르게 모아봅니다."
      >
        <PageStatus
          variant="error"
          message={PAGE_STATUS_COPY.supabaseMissing}
        />
      </ProdPageChrome>
    );
  }

  return (
    <ProdPageChrome
      title="숨은 황금 시즌"
      lead="점수가 높은 주차를 빠르게 모아봅니다."
    >
      {citiesLoading ? <PageStatus variant="loading" /> : null}
      {citiesError ? <PageStatus variant="error" /> : null}

      {!citiesLoading && !citiesError ? (
        <CityPicker cities={cities} cityId={cityId} setCityId={setCityId} />
      ) : null}

      {err ? <PageStatus variant="error" /> : null}
      {loading ? <PageStatus variant="loading" /> : null}

      <ProdSection title="후보 주차">
        {!loading && !err && rows.length === 0 ? (
          <PageStatus variant="empty" />
        ) : null}
        {!loading && !err && rows.length ? (
          <ul className="page-list">
            {rows.map((r) => (
              <li key={r.week_of_year}>
                <strong>{r.week_of_year}주차</strong>
                <span className="page-muted">
                  총점 {r.travel_score?.toFixed(2) ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </ProdSection>
    </ProdPageChrome>
  );
}

export function CompareProdPage() {
  const { cities, citiesLoading, citiesError } = useCities();
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [ma, setMa] = useState<Monthly | null>(null);
  const [mb, setMb] = useState<Monthly | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const month = useMemo(() => new Date().getMonth() + 1, []);

  useEffect(() => {
    if (!cities.length) return;
    setA((prev) => prev || cities[0]?.id || "");
    setB((prev) => prev || cities[1]?.id || cities[0]?.id || "");
  }, [cities]);

  useEffect(() => {
    if (!supabase || !a || !b) {
      setMa(null);
      setMb(null);
      setErr(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr(null);

    void (async () => {
      try {
        const [ra, rb] = await Promise.all([
          supabase
            .from("monthly_climate")
            .select("month,temp_avg,rain_probability,humidity_avg")
            .eq("city_id", a)
            .eq("month", month)
            .maybeSingle(),
          supabase
            .from("monthly_climate")
            .select("month,temp_avg,rain_probability,humidity_avg")
            .eq("city_id", b)
            .eq("month", month)
            .maybeSingle(),
        ]);

        if (ra.error || rb.error) setErr(PAGE_STATUS_COPY.error);
        setMa((ra.data as Monthly | null) ?? null);
        setMb((rb.data as Monthly | null) ?? null);
      } catch {
        setErr(PAGE_STATUS_COPY.error);
      } finally {
        setLoading(false);
      }
    })();
  }, [a, b, month]);

  const name = (id: string) => cities.find((c) => c.id === id)?.name_ko ?? id;

  if (!supabase) {
    return (
      <ProdPageChrome
        title="도시 비교"
        lead="같은 달의 핵심 지표로 두 도시를 비교합니다."
      >
        <PageStatus
          variant="error"
          message={PAGE_STATUS_COPY.supabaseMissing}
        />
      </ProdPageChrome>
    );
  }

  return (
    <ProdPageChrome
      title="도시 비교"
      lead="같은 달의 핵심 지표로 두 도시를 비교합니다."
    >
      {citiesLoading ? <PageStatus variant="loading" /> : null}
      {citiesError ? <PageStatus variant="error" /> : null}

      <div className="prod-row">
        <select
          className="page-select prod-row__grow"
          value={a}
          onChange={(e) => setA(e.target.value)}
        >
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name_ko}
            </option>
          ))}
        </select>
        <select
          className="page-select prod-row__grow"
          value={b}
          onChange={(e) => setB(e.target.value)}
        >
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name_ko}
            </option>
          ))}
        </select>
      </div>

      {err ? <PageStatus variant="error" /> : null}
      {loading ? <PageStatus variant="loading" /> : null}

      <ProdSection title={`${month}월 비교`}>
        {!loading && !err && !ma && !mb ? <PageStatus variant="empty" /> : null}
        {!loading && !err && (ma || mb) ? (
          <div className="prod-tableWrap">
            <table className="page-table">
              <thead>
                <tr>
                  <th>지표</th>
                  <th>{name(a)}</th>
                  <th>{name(b)}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>평균기온</td>
                  <td>{ma?.temp_avg?.toFixed(1) ?? "—"}°C</td>
                  <td>{mb?.temp_avg?.toFixed(1) ?? "—"}°C</td>
                </tr>
                <tr>
                  <td>강수확률</td>
                  <td>
                    {ma?.rain_probability != null
                      ? `${Math.round(ma.rain_probability * 100)}%`
                      : "—"}
                  </td>
                  <td>
                    {mb?.rain_probability != null
                      ? `${Math.round(mb.rain_probability * 100)}%`
                      : "—"}
                  </td>
                </tr>
                <tr>
                  <td>습도</td>
                  <td>{ma?.humidity_avg?.toFixed(0) ?? "—"}%</td>
                  <td>{mb?.humidity_avg?.toFixed(0) ?? "—"}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
      </ProdSection>
    </ProdPageChrome>
  );
}

export function ImpactProdPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [stats, setStats] = useState({ pioneer: 0, badges: 0, dday: 0 });

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      setErr(null);
      return;
    }

    setLoading(true);
    setErr(null);

    void (async () => {
      try {
        const [p, b, d] = await Promise.all([
          supabase
            .from("pioneer_jobs")
            .select("*", { count: "exact", head: true }),
          supabase
            .from("user_badges")
            .select("*", { count: "exact", head: true }),
          supabase
            .from("user_dday_events")
            .select("*", { count: "exact", head: true }),
        ]);

        if (p.error || b.error || d.error) setErr(PAGE_STATUS_COPY.error);
        setStats({
          pioneer: p.count ?? 0,
          badges: b.count ?? 0,
          dday: d.count ?? 0,
        });
      } catch {
        setErr(PAGE_STATUS_COPY.error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (!supabase) {
    return (
      <ProdPageChrome
        title="소셜 임팩트"
        lead="서비스 안에서 만들어지는 작은 변화들을 모읍니다."
      >
        <PageStatus
          variant="error"
          message={PAGE_STATUS_COPY.supabaseMissing}
        />
      </ProdPageChrome>
    );
  }

  return (
    <ProdPageChrome
      title="소셜 임팩트"
      lead="서비스 안에서 만들어지는 작은 변화들을 모읍니다."
    >
      {err ? <PageStatus variant="error" /> : null}
      {loading ? <PageStatus variant="loading" /> : null}

      {!loading && !err ? (
        <div className="prod-metricGrid">
          <div className="prod-metric">
            <div className="prod-metric__label">데이터 확장 시도</div>
            <div className="prod-metric__value">
              {stats.pioneer.toLocaleString("ko-KR")}
            </div>
          </div>
          <div className="prod-metric">
            <div className="prod-metric__label">기여 뱃지</div>
            <div className="prod-metric__value">
              {stats.badges.toLocaleString("ko-KR")}
            </div>
          </div>
          <div className="prod-metric">
            <div className="prod-metric__label">저장된 일정</div>
            <div className="prod-metric__value">
              {stats.dday.toLocaleString("ko-KR")}
            </div>
          </div>
        </div>
      ) : null}
    </ProdPageChrome>
  );
}

export function MyPageProd() {
  const { user, loading } = useAuth();
  const [badges, setBadges] = useState<{ badge: string; earned_at: string }[]>(
    [],
  );
  const [events, setEvents] = useState<
    { event_name: string; event_date: string }[]
  >([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !user) {
      setBadges([]);
      setEvents([]);
      setErr(null);
      setDataLoading(false);
      return;
    }

    setDataLoading(true);
    setErr(null);

    void (async () => {
      try {
        const [b, e] = await Promise.all([
          supabase
            .from("user_badges")
            .select("badge, earned_at")
            .eq("user_id", user.id)
            .order("earned_at", { ascending: false }),
          supabase
            .from("user_dday_events")
            .select("event_name, event_date")
            .eq("user_id", user.id)
            .order("event_date", { ascending: true }),
        ]);

        if (b.error || e.error) setErr(PAGE_STATUS_COPY.error);
        setBadges((b.data ?? []) as { badge: string; earned_at: string }[]);
        setEvents(
          (e.data ?? []) as { event_name: string; event_date: string }[],
        );
      } catch {
        setErr(PAGE_STATUS_COPY.error);
      } finally {
        setDataLoading(false);
      }
    })();
  }, [user]);

  if (!supabase) {
    return (
      <ProdPageChrome
        title="마이페이지"
        lead="내 기록과 저장 데이터를 확인합니다."
      >
        <PageStatus
          variant="error"
          message={PAGE_STATUS_COPY.supabaseMissing}
        />
      </ProdPageChrome>
    );
  }

  if (loading) {
    return (
      <ProdPageChrome
        title="마이페이지"
        lead="내 기록과 저장 데이터를 확인합니다."
      >
        <PageStatus variant="loading" />
      </ProdPageChrome>
    );
  }

  if (!user) {
    return (
      <ProdPageChrome
        title="마이페이지"
        lead="내 기록과 저장 데이터를 확인합니다."
      >
        <PageStatus
          variant="empty"
          message="로그인하면 내 정보를 볼 수 있어요."
        />
      </ProdPageChrome>
    );
  }

  return (
    <ProdPageChrome
      title="마이페이지"
      lead="내 기록과 저장 데이터를 확인합니다."
    >
      {err ? <PageStatus variant="error" /> : null}
      {dataLoading ? <PageStatus variant="loading" /> : null}

      <ProdSection title="내 뱃지">
        {!dataLoading && !err && badges.length === 0 ? (
          <PageStatus variant="empty" />
        ) : null}
        {!dataLoading && !err && badges.length ? (
          <ul className="page-list">
            {badges.map((b, i) => (
              <li key={`${b.badge}-${i}`}>
                <strong>{b.badge}</strong>
                <span className="page-muted">{b.earned_at.slice(0, 10)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </ProdSection>

      <ProdSection title="내 D-day">
        {!dataLoading && !err && events.length === 0 ? (
          <PageStatus variant="empty" />
        ) : null}
        {!dataLoading && !err && events.length ? (
          <ul className="page-list">
            {events.map((e, i) => (
              <li key={`${e.event_name}-${i}`}>
                <strong>{e.event_name}</strong>
                <span className="page-muted">{e.event_date}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </ProdSection>
    </ProdPageChrome>
  );
}
