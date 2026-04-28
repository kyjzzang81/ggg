import { useEffect, useMemo, useRef, useState } from "react";
import { PageStatus } from "../components/PageStatus";
import { useAuth } from "../hooks/useAuth";
import { useCities } from "../hooks/useCities";
import { countryAliasEn, countryEn, countryKo } from "../lib/countryNames";
import { supabase } from "../lib/supabaseClient";
import { PAGE_STATUS_COPY } from "../ui/pageStatus";
import type { WeekScore } from "../types/score";
import "./pages.css";

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

function clampScore(v: number) {
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function ScoreProdPage() {
  const { cities, cityId, setCityId, citiesLoading, citiesError } = useCities();
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
  const [selectedRangeEndIso, setSelectedRangeEndIso] = useState<string | null>(
    null,
  );
  const [travelType] = useState<TravelType>("romantic");
  const [ddayOpen, setDdayOpen] = useState(false);
  const [cityConfirmed, setCityConfirmed] = useState(false);
  const [citySearchOpen, setCitySearchOpen] = useState(false);
  const [viewScoreReady, setViewScoreReady] = useState(false);
  const [closingSheet, setClosingSheet] = useState<"dday" | null>(null);
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
    setCitySearchOpen(false);
  };
  const closeSheet = (sheet: "dday") => {
    setClosingSheet(sheet);
    window.setTimeout(() => {
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
      .filter(
        (c) =>
          c.name_ko.toLowerCase().includes(q) ||
          (c.name_en ?? "").toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q) ||
          (c.country ?? "").toLowerCase().includes(q) ||
          countryEn(c.country).toLowerCase().includes(q) ||
          countryAliasEn(c.country).some((alias) =>
            alias.toLowerCase().includes(q),
          ) ||
          countryKo(c.country).toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [cityQuery, cities]);

  useEffect(() => {
    setViewScoreReady(false);
    setDdayOpen(false);
    setSelectedDateIso(null);
    setSelectedRangeEndIso(null);
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
  const monthDayScoreMap = useMemo(() => {
    const year = new Date().getFullYear();
    const map = new Map<number, number>();
    for (const row of activityRows) {
      const date = dayOfYearToDate(row.day_of_year);
      if (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() + 1 === selectedMonth
      ) {
        map.set(date.getUTCDate(), Math.round((row.score ?? 0) * 100));
      }
    }
    return map;
  }, [activityRows, selectedMonth]);
  const selectedRangeStartDay = useMemo(() => {
    if (!selectedDateIso) return null;
    const [yearStr, monthStr, dayStr] = selectedDateIso.split("-");
    if (!yearStr || !monthStr || !dayStr) return null;
    const month = Number(monthStr);
    const day = Number(dayStr);
    return month === selectedMonth ? day : null;
  }, [selectedDateIso, selectedMonth]);
  const selectedRangeEndDay = useMemo(() => {
    if (!selectedRangeEndIso) return null;
    const [yearStr, monthStr, dayStr] = selectedRangeEndIso.split("-");
    if (!yearStr || !monthStr || !dayStr) return null;
    const month = Number(monthStr);
    const day = Number(dayStr);
    return month === selectedMonth ? day : null;
  }, [selectedRangeEndIso, selectedMonth]);

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

  const selectedMonthScore = useMemo(
    () => monthScoreBars.find((bar) => bar.month === selectedMonth)?.score ?? 0,
    [monthScoreBars, selectedMonth],
  );

  const scoreBadgeLabel = useMemo(() => {
    if (selectedMonthScore >= 80) return "강력 추천";
    if (selectedMonthScore >= 60) return "추천";
    if (selectedMonthScore >= 45) return "보통";
    return "비추천";
  }, [selectedMonthScore]);

  const scorePercentile = useMemo(() => {
    const sorted = [...monthScoreBars.map((x) => x.score)].sort(
      (a, b) => b - a,
    );
    const idx = sorted.findIndex((x) => x === selectedMonthScore);
    if (idx < 0) return 50;
    const pct = ((idx + 1) / Math.max(1, sorted.length)) * 100;
    return clampScore(100 - pct + 1);
  }, [monthScoreBars, selectedMonthScore]);

  const scoreBreakdown = useMemo(() => {
    const targetWeeks = weeks.slice(0, 8);
    if (!targetWeeks.length) {
      return {
        comfort: selectedMonthScore,
        rain: selectedMonthScore,
        air: selectedMonthScore,
      };
    }
    const avg = (vals: Array<number | null | undefined>, fallback: number) => {
      const nums = vals.filter((v): v is number => typeof v === "number");
      if (!nums.length) return fallback;
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    };
    const comfort = clampScore(
      avg(
        targetWeeks.map((w) => w.temp_score),
        selectedMonthScore,
      ) * 100,
    );
    const rain = clampScore(
      avg(
        targetWeeks.map((w) => w.rain_score),
        selectedMonthScore,
      ) * 100,
    );
    const humidity = avg(
      targetWeeks.map((w) => w.humidity_score),
      (100 - selectedMonthScore) / 100,
    );
    const air = clampScore((1 - humidity) * 100);
    return { comfort, rain, air };
  }, [selectedMonthScore, weeks]);

  const selectedRangeText = useMemo(() => {
    if (selectedDateIso && selectedRangeEndIso)
      return `${selectedDateIso} ~ ${selectedRangeEndIso}`;
    if (selectedDateIso) return selectedDateIso;
    if (viewMode === "month") return `${selectedMonth}월`;
    if (viewMode === "week") return `${selectedWeek ?? "-"}주차`;
    return selectedDay ? `${selectedDay}일` : "일별";
  }, [
    selectedDateIso,
    selectedRangeEndIso,
    selectedDay,
    selectedMonth,
    selectedWeek,
    viewMode,
  ]);

  const selectedRangeDays = useMemo(() => {
    if (selectedDateIso && selectedRangeEndIso) {
      const start = new Date(`${selectedDateIso}T00:00:00Z`).getTime();
      const end = new Date(`${selectedRangeEndIso}T00:00:00Z`).getTime();
      const diff = Math.floor((end - start) / 86400000) + 1;
      return Math.max(1, diff);
    }
    if (selectedDateIso) return 1;
    if (viewMode === "week") return 7;
    return 5;
  }, [selectedDateIso, selectedRangeEndIso, viewMode]);

  const scoreInsightText = useMemo(() => {
    if (selectedMonthScore >= 80)
      return `${selectedMonth}월은 ${selectedCity?.name_ko ?? "선택 도시"} 여행 최적기예요. 야외 이동/일정 밀도를 높여도 무리가 적어요.`;
    if (selectedMonthScore >= 60)
      return `${selectedMonth}월은 전반적으로 무난해요. 오후 강수 가능성만 체크하면 일정 운영이 좋아요.`;
    if (selectedMonthScore >= 45)
      return `${selectedMonth}월은 변동 구간이 있어요. 실내 대안 일정과 우선순위 분리가 필요해요.`;
    return `${selectedMonth}월은 날씨 리스크가 큰 편이에요. 짧은 일정과 실내 중심 동선을 추천해요.`;
  }, [selectedCity?.name_ko, selectedMonth, selectedMonthScore]);
  const scoreDetailLines = useMemo(() => {
    const metrics = [
      { label: "쾌적", value: scoreBreakdown.comfort },
      { label: "강수", value: scoreBreakdown.rain },
      { label: "공기", value: scoreBreakdown.air },
    ];
    const sorted = [...metrics].sort((a, b) => b.value - a.value);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    return [
      `${selectedRangeText} 기준 ${selectedCity?.name_ko ?? "선택 도시"}의 평균 가이드는 ${scoreBadgeLabel}입니다.`,
      `강점은 ${best.label}(${best.value})이고, ${selectedRangeDays}일 일정에서 체감 안정성이 높아요.`,
      `주의 지표는 ${worst.label}(${worst.value})이므로 일정 전날/당일 재확인을 권장해요.`,
    ];
  }, [
    scoreBreakdown.air,
    scoreBreakdown.comfort,
    scoreBreakdown.rain,
    scoreBadgeLabel,
    selectedCity?.name_ko,
    selectedRangeDays,
    selectedRangeText,
  ]);
  const hasSelectedRange = Boolean(selectedDateIso || selectedRangeEndIso);
  const isCurrentMonth = selectedMonth === new Date().getMonth() + 1;

  if (!supabase) {
    return (
      <article className="home-page prod-page">
        <PageStatus
          variant="error"
          message={PAGE_STATUS_COPY.supabaseMissing}
        />
      </article>
    );
  }

  return (
    <article className="home-page prod-page">
      {citiesError ? <PageStatus variant="error" /> : null}

      {err ? <PageStatus variant="error" /> : null}

      {citiesLoading ? <ScoreEntrySkeleton /> : null}

      {!citiesLoading && !citiesError && !cityConfirmed ? (
        <>
          <section className="home-hero prod-hero">
            <h1 className="prod-hero__title prod-hero__title--score">
              <span>어디로</span>
              <br />
              떠나고 싶으세요?
            </h1>
            <button
              type="button"
              className="prod-hero__cta"
              onClick={() => {
                setCitySearchOpen(true);
                setShowCityResults(true);
              }}
            >
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <span>도시 찾기</span>
            </button>
          </section>

          <section className="home-section">
            <div className="score-featured-panel">
              <p className="score-featured-panel__title">👋 이주의 추천 도시</p>
              <div className="score-featured-cities">
                {featuredCities.slice(0, 4).map((city) => (
                  <button
                    key={city.id}
                    type="button"
                    onClick={() => {
                      selectCityAndAdvance(city.id, city.name_ko);
                    }}
                  >
                    <strong>{city.name_ko}</strong>
                    <span>{countryKo(city.country) || "추천 도시"}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        </>
      ) : null}

      {!citiesLoading && citySearchOpen ? (
        <div className="score-search-sheet" role="dialog" aria-modal="true">
          <button
            type="button"
            className="score-search-sheet__backdrop"
            onClick={() => setCitySearchOpen(false)}
            aria-label="닫기"
          />
          <div className="score-search-sheet__panel">
            <input
              type="text"
              className="score-search-sheet__field"
              value={cityQuery}
              placeholder="도시 이름을 입력해 찾아보세요"
              autoFocus
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
                    <span>{countryKo(city.country)}</span>
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
        </div>
      ) : null}

      {cityConfirmed ? (
        <>
          {showLoadingSkeleton ? (
            <section
              ref={calendarSectionRef}
              className="prod-section score-flow"
            >
              <ScoreLoadingSkeleton />
            </section>
          ) : (
            <>
              <section ref={calendarSectionRef} className="home-hero prod-hero">
                <div className="prod-hero__head">
                  <h1 className="prod-hero__title prod-hero__title--score">
                    <span>{selectedCity?.name_ko ?? "선택 도시"}</span>
                  </h1>
                  <button
                    type="button"
                    className="prod-hero__action"
                    aria-label="도시 변경"
                    onClick={() => {
                      setCitySearchOpen(true);
                      setShowCityResults(true);
                    }}
                  >
                    <svg
                      aria-hidden="true"
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 7h14" />
                      <path d="m13 3 4 4-4 4" />
                      <path d="M21 17H7" />
                      <path d="m11 21-4-4 4-4" />
                    </svg>
                  </button>
                </div>
                <div className="prod-hero__meta">
                  <span className="prod-hero__meta-text">
                    {selectedRangeText}
                  </span>
                  <span className="prod-hero__chip">
                    {selectedRangeDays}일간
                  </span>
                </div>
              </section>

              <section className="prod-section score-flow">
                {!viewScoreReady ? (
                  <>
                    {viewMode === "month" ? (
                      <div className="score-month-calendar">
                        <div className="score-month-calendar__head">
                          <div className="score-month-calendar__head-actions">
                            <button
                              type="button"
                              className="score-month-calendar__today"
                              disabled={isCurrentMonth}
                              onClick={() => {
                                setSelectedMonth(new Date().getMonth() + 1);
                              }}
                            >
                              오늘
                            </button>
                            <button
                              type="button"
                              className="score-month-calendar__clear"
                              disabled={!hasSelectedRange}
                              onClick={() => {
                                setSelectedDateIso(null);
                                setSelectedRangeEndIso(null);
                                setSelectedDay(null);
                              }}
                            >
                              초기화
                            </button>
                          </div>
                          <strong className="score-month-calendar__head-title">
                            {new Date().getFullYear()}년 {selectedMonth}월
                          </strong>
                          <div className="score-month-calendar__head-nav">
                            <button
                              type="button"
                              className="score-month-calendar__head-arrow"
                              onClick={() =>
                                setSelectedMonth((prev) =>
                                  prev <= 1 ? 12 : prev - 1,
                                )
                              }
                            >
                              &#8249;
                            </button>
                            <button
                              type="button"
                              className="score-month-calendar__head-arrow"
                              onClick={() =>
                                setSelectedMonth((prev) =>
                                  prev >= 12 ? 1 : prev + 1,
                                )
                              }
                            >
                              &#8250;
                            </button>
                          </div>
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
                              <div className="score-month-calendar__days">
                                {week.days.map((cell, dayIdx) => (
                                  <button
                                    key={`${week.weekNo}-${dayIdx}`}
                                    type="button"
                                    className={`score-month-calendar__day ${cell.kind} ${selectedDay === cell.day ? "is-picked" : ""} ${
                                      selectedRangeStartDay &&
                                      cell.day === selectedRangeStartDay
                                        ? "is-range-start"
                                        : ""
                                    } ${
                                      selectedRangeEndDay &&
                                      cell.day === selectedRangeEndDay
                                        ? "is-range-end"
                                        : ""
                                    } ${
                                      selectedRangeStartDay &&
                                      selectedRangeEndDay &&
                                      cell.day > selectedRangeStartDay &&
                                      cell.day < selectedRangeEndDay
                                        ? "is-in-range"
                                        : ""
                                    }`}
                                    disabled={cell.day === 0}
                                    onClick={() => {
                                      if (cell.day <= 0) return;
                                      setSelectedDay(cell.day);
                                      const y = new Date().getFullYear();
                                      const iso = `${y}-${String(selectedMonth).padStart(2, "0")}-${String(cell.day).padStart(2, "0")}`;
                                      if (
                                        !selectedDateIso ||
                                        selectedRangeEndIso
                                      ) {
                                        setSelectedDateIso(iso);
                                        setSelectedRangeEndIso(null);
                                        return;
                                      }
                                      if (iso < selectedDateIso) {
                                        setSelectedRangeEndIso(selectedDateIso);
                                        setSelectedDateIso(iso);
                                        return;
                                      }
                                      if (iso === selectedDateIso) {
                                        setSelectedRangeEndIso(null);
                                        return;
                                      }
                                      setSelectedRangeEndIso(iso);
                                    }}
                                  >
                                    {cell.day > 0 ? (
                                      <>
                                        <strong className="score-month-calendar__day-num">
                                          {cell.day}
                                        </strong>
                                        <span className="score-month-calendar__day-meta">
                                          <span
                                            className="score-month-calendar__day-dot"
                                            aria-hidden="true"
                                          />
                                          <span className="score-month-calendar__day-score">
                                            {monthDayScoreMap.get(cell.day) ??
                                              "--"}
                                          </span>
                                        </span>
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
                        {(viewMode === "week" ? weekCells : dayCells).map(
                          (cell) => (
                            <button
                              key={cell.key}
                              type="button"
                              className={`score-calendar-cell ${cell.picked ? "is-picked" : ""}`}
                              onClick={() => {
                                if (viewMode === "week")
                                  setSelectedWeek(
                                    Number(cell.key.replace("w-", "")),
                                  );
                                if (viewMode === "day")
                                  setSelectedDay(
                                    Number(cell.key.replace("d-", "")),
                                  );
                              }}
                            >
                              <span>{cell.label}</span>
                              <strong>
                                {Number.isFinite(cell.score) ? cell.score : 0}
                              </strong>
                            </button>
                          ),
                        )}
                      </div>
                    )}
                    {viewMode === "month" ? (
                      <div className="score-month-bars">
                        <h3 className="score-month-bars__title">월간 스코어</h3>
                        <div className="score-month-bars__chart">
                          {monthScoreBars.map((bar) => (
                            <div
                              key={bar.month}
                              className="score-month-bars__column"
                            >
                              <div className="score-month-bars__track">
                                <button
                                  type="button"
                                  aria-label={`${bar.month}월 ${bar.score}점`}
                                  className={`score-month-bars__bar ${bar.kind} ${selectedMonth === bar.month ? "is-active" : ""}`}
                                  style={{
                                    height: `${Math.max(8, (bar.score / 100) * 100)}%`,
                                  }}
                                  onClick={() => setSelectedMonth(bar.month)}
                                />
                              </div>
                              <div className="score-month-bars__caption">
                                <strong>{bar.score}</strong>
                                <span>{bar.month}월</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <div className="score-insight-banner">
                      <p className="score-insight-banner__title">
                        월간 Insight
                      </p>
                      <p className="score-insight-banner__text">
                        {scoreInsightText}
                      </p>
                    </div>
                    <div className="score-view-actions">
                      <button
                        type="button"
                        className="page-btn page-btn--primary score-cta"
                        disabled={loading || showLoadingSkeleton}
                        onClick={() => setViewScoreReady(true)}
                      >
                        스코어 보기
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="score-result-panel">
                    <div className="score-hero-card">
                      <div className="score-hero-card__row">
                        <p className="score-hero-card__label">
                          <span className="score-hero-card__chip">
                            과거 1년 기준
                          </span>
                          <span>상위 {scorePercentile}% 날씨</span>
                        </p>
                        <div className="score-hero-card__score">
                          <strong>{selectedMonthScore}</strong>
                          <span>/ 100</span>
                        </div>
                      </div>
                      <div className="score-hero-bars">
                        <div className="score-hero-bars__row">
                          <span>쾌적</span>
                          <div className="score-hero-bars__track">
                            <div
                              style={{ width: `${scoreBreakdown.comfort}%` }}
                            />
                          </div>
                          <strong>{scoreBreakdown.comfort}</strong>
                        </div>
                        <div className="score-hero-bars__row">
                          <span>강수</span>
                          <div className="score-hero-bars__track">
                            <div style={{ width: `${scoreBreakdown.rain}%` }} />
                          </div>
                          <strong>{scoreBreakdown.rain}</strong>
                        </div>
                        <div className="score-hero-bars__row">
                          <span>공기</span>
                          <div className="score-hero-bars__track">
                            <div style={{ width: `${scoreBreakdown.air}%` }} />
                          </div>
                          <strong>{scoreBreakdown.air}</strong>
                        </div>
                      </div>
                    </div>
                    <div className="score-result-panel__copy">
                      {scoreDetailLines.map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                    </div>
                    <div className="score-cta-wrap">
                      <button
                        type="button"
                        className="page-btn page-btn--primary score-cta"
                        onClick={() => setDdayOpen(true)}
                      >
                        D-Day 저장
                      </button>
                    </div>
                  </div>
                )}
              </section>
            </>
          )}
        </>
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
                ? selectedDateIso
                  ? selectedRangeEndIso
                    ? `${selectedDateIso} ~ ${selectedRangeEndIso}`
                    : selectedDateIso
                  : `${selectedMonth}월`
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
    <>
      <section className="home-hero prod-hero" aria-hidden="true">
        <div className="score-entry-skeleton__question" />
        <div className="score-entry-skeleton__field" />
      </section>
      <section className="home-section" aria-hidden="true">
        <div className="score-featured-panel">
          <div className="score-entry-skeleton__title" />
          <div className="score-entry-skeleton__cards">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="score-entry-skeleton__card" />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
