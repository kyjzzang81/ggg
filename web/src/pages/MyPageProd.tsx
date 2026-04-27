import { useEffect, useState } from "react";
import { PageStatus } from "../components/PageStatus";
import { ProdPageChrome, ProdSection } from "../components/ProdPageChrome";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabaseClient";
import { PAGE_STATUS_COPY } from "../ui/pageStatus";
import "./pages.css";

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
