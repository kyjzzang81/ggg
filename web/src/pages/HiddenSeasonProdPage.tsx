import { useEffect, useState } from "react";
import { CityPicker } from "../components/CityPicker";
import { PageStatus } from "../components/PageStatus";
import { ProdPageChrome, ProdSection } from "../components/ProdPageChrome";
import { useCities } from "../hooks/useCities";
import { supabase } from "../lib/supabaseClient";
import { PAGE_STATUS_COPY } from "../ui/pageStatus";
import type { WeekScore } from "../types/score";
import "./pages.css";

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
