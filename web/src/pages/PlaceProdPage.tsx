import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Camera,
  Mountain,
  TreePalm,
  UtensilsCrossed,
  Waves,
} from "lucide-react";
import { NearbyGsScore } from "../components/NearbyGsScore";
import { PageStatus } from "../components/PageStatus";
import { useCities, type CityRow } from "../hooks/useCities";
import { countryKo } from "../lib/countryNames";
import { supabase } from "../lib/supabaseClient";
import { PAGE_STATUS_COPY } from "../ui/pageStatus";
import "./pages.css";

type PlaceActivityId =
  | "beach"
  | "hiking"
  | "city_sightseeing"
  | "photo"
  | "food"
  | "family";

type PlaceActivityOption = {
  id: PlaceActivityId;
  label: string;
  Icon: typeof Mountain;
  /** activity column 값 (DB에 저장된 활동) */
  dbValue: "beach" | "hiking" | "city_sightseeing";
};

const PLACE_ACTIVITY_OPTIONS: PlaceActivityOption[] = [
  {
    id: "family",
    label: "가족 여행",
    Icon: TreePalm,
    dbValue: "city_sightseeing",
  },
  { id: "beach", label: "해수욕", Icon: Waves, dbValue: "beach" },
  { id: "hiking", label: "트레킹", Icon: Mountain, dbValue: "hiking" },
  { id: "photo", label: "사진", Icon: Camera, dbValue: "city_sightseeing" },
  {
    id: "food",
    label: "미식",
    Icon: UtensilsCrossed,
    dbValue: "city_sightseeing",
  },
  {
    id: "city_sightseeing",
    label: "도시 관광",
    Icon: Building2,
    dbValue: "city_sightseeing",
  },
];

const PLACE_ACTIVITY_TAGS: Record<PlaceActivityId, string[]> = {
  family: ["가족친화", "안전"],
  beach: ["바다", "해수욕"],
  hiking: ["트레킹", "자연"],
  photo: ["사진", "풍경"],
  food: ["미식", "도시"],
  city_sightseeing: ["도시", "문화"],
};

const MONTH_DAY_RANGES: { start: number; end: number }[] = [
  { start: 1, end: 31 },
  { start: 32, end: 59 },
  { start: 60, end: 90 },
  { start: 91, end: 120 },
  { start: 121, end: 151 },
  { start: 152, end: 181 },
  { start: 182, end: 212 },
  { start: 213, end: 243 },
  { start: 244, end: 273 },
  { start: 274, end: 304 },
  { start: 305, end: 334 },
  { start: 335, end: 365 },
];

function placeRankToGrade(rank: number, score: number) {
  if (rank <= 1 || score >= 80) return "gorgeous";
  if (rank <= 3 || score >= 65) return "great";
  if (score >= 50) return "good";
  return "meh";
}

function placeRankNearbyRank(grade: ReturnType<typeof placeRankToGrade>) {
  if (grade === "gorgeous") return 1;
  if (grade === "great") return 2;
  return 3;
}

type RankedPlace = {
  city: CityRow;
  best_score: number;
  best_day: number;
};

export function PlaceProdPage() {
  const { cities, citiesLoading, citiesError } = useCities();
  const [activityId, setActivityId] = useState<PlaceActivityId>("family");
  const [selectedMonth, setSelectedMonth] = useState<number>(
    new Date().getMonth() + 1,
  );
  const [rankedCities, setRankedCities] = useState<RankedPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const activityOption = useMemo(
    () =>
      PLACE_ACTIVITY_OPTIONS.find((opt) => opt.id === activityId) ??
      PLACE_ACTIVITY_OPTIONS[0],
    [activityId],
  );

  const cityMap = useMemo(() => {
    const map = new Map<string, CityRow>();
    for (const c of cities) map.set(c.id, c);
    return map;
  }, [cities]);

  useEffect(() => {
    if (!supabase) {
      setRankedCities([]);
      setLoading(false);
      return;
    }
    if (!cities.length) return;

    const range = MONTH_DAY_RANGES[selectedMonth - 1];
    if (!range) return;

    setLoading(true);
    setErr(null);

    void (async () => {
      try {
        const { data, error } = await supabase
          .from("activity_weather_score")
          .select("city_id, day_of_year, score")
          .eq("activity", activityOption.dbValue)
          .gte("day_of_year", range.start)
          .lte("day_of_year", range.end)
          .order("score", { ascending: false })
          .limit(400);

        if (error) {
          setErr(PAGE_STATUS_COPY.error);
          setRankedCities([]);
          return;
        }

        const rows = (data ?? []) as {
          city_id: string;
          day_of_year: number;
          score: number;
        }[];

        const bestByCity = new Map<
          string,
          { score: number; day_of_year: number }
        >();
        for (const r of rows) {
          const cur = bestByCity.get(r.city_id);
          if (!cur || r.score > cur.score) {
            bestByCity.set(r.city_id, {
              score: r.score,
              day_of_year: r.day_of_year,
            });
          }
        }

        const ranked: RankedPlace[] = [];
        for (const [id, info] of bestByCity.entries()) {
          const city = cityMap.get(id);
          if (!city) continue;
          ranked.push({
            city,
            best_score: info.score,
            best_day: info.day_of_year,
          });
        }
        ranked.sort((a, b) => b.best_score - a.best_score);

        setRankedCities(ranked.slice(0, 12));
      } catch {
        setErr(PAGE_STATUS_COPY.error);
        setRankedCities([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [activityOption.dbValue, cityMap, cities.length, selectedMonth]);

  if (!supabase) {
    return (
      <article className="prod-page">
        <section className="home-hero prod-hero">
          <h1 className="prod-hero__title prod-hero__title--place">
            <span>장소</span> 추천
          </h1>
          <p className="prod-hero__desc prod-hero__desc--place">
            여행 목적과 시기에 맞는 도시를 ggg score로 추천해드려요.
          </p>
        </section>
        <section className="home-section">
          <PageStatus
            variant="error"
            message={PAGE_STATUS_COPY.supabaseMissing}
          />
        </section>
      </article>
    );
  }

  const monthLabel = `${selectedMonth}월`;
  const showLoading = citiesLoading || loading;
  const showEmpty =
    !showLoading && !err && !citiesError && rankedCities.length === 0;

  return (
    <article className="prod-page">
      {/* Hero */}
      <section className="home-hero prod-hero">
        <h1 className="prod-hero__title prod-hero__title--place">
          <span>{activityOption.label}</span>
          <br />
          어디로 떠나볼까요?
        </h1>
        <p className="prod-hero__desc prod-hero__desc--place">
          여행 목적과 시기에 맞는 도시를 ggg score로 골라드려요.
        </p>
      </section>

      {/* 여행 목적 */}
      <section className="home-section">
        <div className="home-section__head">
          <h3 className="home-section__title">여행 목적</h3>
        </div>
        <div className="place-purpose-chips">
          {PLACE_ACTIVITY_OPTIONS.map((opt) => {
            const Icon = opt.Icon;
            const active = opt.id === activityId;
            return (
              <button
                key={opt.id}
                type="button"
                className={`place-purpose-chip${active ? " is-active" : ""}`}
                onClick={() => setActivityId(opt.id)}
              >
                <Icon size={16} aria-hidden="true" />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 시기 선택 */}
      <section className="home-section">
        <div className="home-section__head">
          <h3 className="home-section__title">언제 떠나시나요?</h3>
          <span className="home-section__hint">평년 기준</span>
        </div>
        <div className="place-month-chips">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <button
              key={m}
              type="button"
              className={`place-month-chip${selectedMonth === m ? " is-active" : ""}`}
              onClick={() => setSelectedMonth(m)}
            >
              {m}월
            </button>
          ))}
        </div>
      </section>

      {/* 추천 도시 결과 */}
      <section className="home-section">
        <div className="home-section__head">
          <h3 className="home-section__title">
            추천 도시 {rankedCities.length}곳
          </h3>
          <span className="home-section__hint">
            {monthLabel} · {activityOption.label} · 점수 순
          </span>
        </div>

        {citiesError ? (
          <PageStatus variant="error" message={citiesError} />
        ) : null}
        {err ? <PageStatus variant="error" message={err} /> : null}

        {showLoading ? (
          <div className="place-result-list">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="place-card-skeleton" aria-hidden="true">
                <div className="place-card-skeleton__rank" />
                <div className="place-card-skeleton__body">
                  <div className="place-card-skeleton__title" />
                  <div className="place-card-skeleton__desc" />
                  <div className="place-card-skeleton__chips" />
                </div>
                <div className="place-card-skeleton__score" />
              </div>
            ))}
          </div>
        ) : null}

        {showEmpty ? (
          <PageStatus
            variant="empty"
            message="해당 조건에 맞는 추천 도시가 아직 없어요."
          />
        ) : null}

        {!showLoading && !err && !citiesError && rankedCities.length > 0 ? (
          <div className="place-result-list">
            {rankedCities.map((row, idx) => {
              const grade = placeRankToGrade(idx + 1, row.best_score);
              const tags = PLACE_ACTIVITY_TAGS[activityId] ?? [];
              const country = countryKo(row.city.country) || "";
              return (
                <article
                  key={row.city.id}
                  className={`home-place-card place-card place-card--${grade}`}
                >
                  <div className="home-place-card__body place-card__body">
                    <div className="home-place-card__head">
                      <h3 className="home-place-card__name">
                        {row.city.name_ko}
                      </h3>
                      <p className="home-place-card__desc">
                        {country ? `${country} · ` : ""}
                        {monthLabel} 평균 적합도 {row.best_score.toFixed(0)}점 ·{" "}
                        {activityOption.label}에 좋아요
                      </p>
                    </div>
                    <div className="place-card__chips">
                      {tags.map((tag) => (
                        <span key={tag} className="place-card__tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="place-card__score">
                    <div className="place-card__rank">#{idx + 1}</div>
                    <NearbyGsScore rank={placeRankNearbyRank(grade)} />
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>
    </article>
  );
}
