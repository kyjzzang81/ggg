import { useEffect, useMemo, useState } from "react";
import { PageStatus } from "../components/PageStatus";
import { ProdPageChrome, ProdSection } from "../components/ProdPageChrome";
import { useCities } from "../hooks/useCities";
import { supabase } from "../lib/supabaseClient";
import { PAGE_STATUS_COPY } from "../ui/pageStatus";
import "./pages.css";

type Monthly = {
  month: number;
  temp_avg: number | null;
  rain_probability: number | null;
  humidity_avg: number | null;
};

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
