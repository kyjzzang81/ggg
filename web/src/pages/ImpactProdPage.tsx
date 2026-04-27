import { useEffect, useState } from "react";
import { PageStatus } from "../components/PageStatus";
import { ProdPageChrome } from "../components/ProdPageChrome";
import { supabase } from "../lib/supabaseClient";
import { PAGE_STATUS_COPY } from "../ui/pageStatus";
import "./pages.css";

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
