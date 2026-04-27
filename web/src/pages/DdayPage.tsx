import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { PageStatus } from "../components/PageStatus";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../hooks/useAuth";
import { PAGE_STATUS_COPY } from "../ui/pageStatus";
import "./pages.css";

type DdayRow = {
  id: number
  city_id: string | null
  event_name: string
  event_date: string
  event_type: string
  note: string | null
  notify_d30: boolean
  notify_d7: boolean
  notify_d1: boolean
}

type City = { id: string; name_ko: string }

const eventTypes = [
  { value: 'travel', label: '여행' },
  { value: 'anniversary', label: '기념일' },
  { value: 'birthday', label: '생일' },
] as const

export function DdayPage() {
  const { user, loading: authLoading } = useAuth();
  const [cities, setCities] = useState<City[]>([]);
  const [rows, setRows] = useState<DdayRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<DdayRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [closingSheet, setClosingSheet] = useState(false);

  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [cityId, setCityId] = useState("");
  const [eventType, setEventType] = useState<string>("travel");
  const [note, setNote] = useState("");
  const [n30, setN30] = useState(true);
  const [n7, setN7] = useState(true);
  const [n1, setN1] = useState(true);

  const resetForm = useCallback(() => {
    setEditing(null);
    setEventName("");
    setEventDate("");
    setCityId("");
    setEventType("travel");
    setNote("");
    setN30(true);
    setN7(true);
    setN1(true);
  }, []);

  const closeSheet = useCallback(() => {
    setClosingSheet(true);
    window.setTimeout(() => {
      setSheetOpen(false);
      setClosingSheet(false);
      resetForm();
    }, 220);
  }, [resetForm]);

  const loadList = useCallback(async () => {
    if (!supabase || !user) return;
    setLoading(true);
    setErr(null);
    const { data, error } = await supabase
      .from("user_dday_events")
      .select(
        "id, city_id, event_name, event_date, event_type, note, notify_d30, notify_d7, notify_d1",
      )
      .order("event_date", { ascending: true });

    if (error) {
      console.warn("[dday] load failed", error);
      setErr(PAGE_STATUS_COPY.error);
      setRows([]);
    } else setRows((data ?? []) as DdayRow[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!supabase) return;
    void supabase
      .from("cities")
      .select("id, name_ko")
      .order("name_ko")
      .limit(100)
      .then(({ data }) => setCities((data ?? []) as City[]));
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadList();
    });
  }, [loadList]);

  const startEdit = (r: DdayRow) => {
    setEditing(r);
    setEventName(r.event_name);
    setEventDate(r.event_date);
    setCityId(r.city_id ?? "");
    setEventType(r.event_type);
    setNote(r.note ?? "");
    setN30(r.notify_d30);
    setN7(r.notify_d7);
    setN1(r.notify_d1);
    setSheetOpen(true);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase || !user) return;
    setErr(null);
    const payload = {
      user_id: user.id,
      event_name: eventName.trim(),
      event_date: eventDate,
      city_id: cityId || null,
      event_type: eventType,
      note: note.trim() || null,
      notify_d30: n30,
      notify_d7: n7,
      notify_d1: n1,
    };
    if (!payload.event_name || !payload.event_date) {
      setErr("이름과 날짜는 필수입니다.");
      return;
    }

    if (editing) {
      const { error } = await supabase
        .from("user_dday_events")
        .update({
          event_name: payload.event_name,
          event_date: payload.event_date,
          city_id: payload.city_id,
          event_type: payload.event_type,
          note: payload.note,
          notify_d30: payload.notify_d30,
          notify_d7: payload.notify_d7,
          notify_d1: payload.notify_d1,
        })
        .eq("id", editing.id)
        .eq("user_id", user.id);
      if (error) {
        console.warn("[dday] update failed", error);
        setErr(PAGE_STATUS_COPY.error);
      } else closeSheet();
    } else {
      const { error } = await supabase.from("user_dday_events").insert(payload);
      if (error) {
        console.warn("[dday] insert failed", error);
        setErr(PAGE_STATUS_COPY.error);
      } else closeSheet();
    }
    await loadList();
  };

  const remove = async (id: number) => {
    if (!supabase || !user) return;
    if (!confirm("이 일정을 삭제할까요?")) return;
    const { error } = await supabase
      .from("user_dday_events")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) {
      console.warn("[dday] delete failed", error);
      setErr(PAGE_STATUS_COPY.error);
    } else {
      if (editing?.id === id) closeSheet();
      await loadList();
    }
  };

  const signInGoogle = async () => {
    if (!supabase) return;
    setErr(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      console.warn("[dday] oauth failed", error);
      setErr(PAGE_STATUS_COPY.error);
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    resetForm();
    setRows([]);
  };

  const cityNameById = useMemo(() => {
    return new Map(cities.map((c) => [c.id, c.name_ko]));
  }, [cities]);

  const topFilters = useMemo(() => {
    const values = rows
      .slice(0, 3)
      .map((r) => {
        const cityName = r.city_id ? (cityNameById.get(r.city_id) ?? "도시명") : "도시명";
        return `${cityName}-${r.event_date.slice(5).replace("-", ".")}`;
      });
    while (values.length < 3) values.push("장소명-날짜");
    return values;
  }, [rows, cityNameById]);

  const openCreateSheet = () => {
    resetForm();
    setSheetOpen(true);
  };

  if (!supabase) {
    return (
      <article className="home-page prod-page">
        <PageStatus variant="error" message={PAGE_STATUS_COPY.supabaseMissing} />
      </article>
    );
  }

  if (authLoading) {
    return (
      <article className="home-page prod-page">
        <DdayPageSkeleton />
      </article>
    );
  }

  if (!user) {
    return (
      <article className="home-page prod-page prod-page--auth">
        <h1 className="prod-hero__title prod-hero__title--dday">
          <span>D</span> Day
        </h1>
        <p className="prod-hero__desc prod-hero__desc--dday">
          로그인하면 D-day를 저장하고 알림을 받을 수 있어요.
        </p>
        <PageStatus variant="empty" message="로그인하면 일정을 저장할 수 있어요." />
        {err ? <PageStatus variant="error" /> : null}
        <button type="button" className="page-btn page-btn--primary" onClick={signInGoogle}>
          Google로 로그인
        </button>
      </article>
    );
  }

  return (
    <article className="home-page prod-page">
      <section className="home-section prod-hero">
        <h1 className="prod-hero__title prod-hero__title--dday">
          <span>D</span> Day
        </h1>
        <p className="prod-hero__desc prod-hero__desc--dday">
          여행일정을 저장해, 예보가 시작될 경우, 알림을 받아 보세요!
        </p>
      </section>

      <section className="home-section dday-page__filters">
        <div className="dday-filter-tabs">
          {topFilters.map((label, idx) => (
            <button key={`${label}-${idx}`} type="button" className={idx === 0 ? "is-active" : ""}>
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="dday-add-btn" onClick={openCreateSheet}>
          +추가
        </button>
      </section>

      {err ? <PageStatus variant="error" /> : null}

      {loading && rows.length === 0 ? (
        <DdayListSkeleton />
      ) : (
        <>
          {!loading && rows.length === 0 ? (
            <PageStatus variant="empty" message="아직 저장된 D-day 일정이 없어요." />
          ) : null}

          <section className="home-section dday-list">
            {rows.map((r) => {
              const cityName = r.city_id
                ? (cityNameById.get(r.city_id) ?? r.city_id)
                : "도시명";
              return (
                <article key={r.id} className="dday-card home-place-card">
                  <div className="home-place-card__body">
                    <div className="dday-card__head">
                      <div>
                        <h3 className="home-place-card__name">
                          {r.event_name}
                        </h3>
                        <p className="home-place-card__desc">
                          {cityName}{" "}
                          <span>{r.note?.trim() || "여행기간"}</span>
                        </p>
                      </div>
                      <div className="dday-card__actions">
                        <button
                          type="button"
                          onClick={() => startEdit(r)}
                          aria-label="수정"
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(r.id)}
                          aria-label="삭제"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <div className="dday-card__alarm-row">
                      <label>
                        <input type="checkbox" checked={r.notify_d30} readOnly />
                        <span>D-30일</span>
                      </label>
                      <label>
                        <input type="checkbox" checked={r.notify_d7} readOnly />
                        <span>D-7일</span>
                      </label>
                      <label>
                        <input type="checkbox" checked={r.notify_d1} readOnly />
                        <span>D-1일</span>
                      </label>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        </>
      )}

      {(sheetOpen || closingSheet) && (
        <div className={`home-sheet${closingSheet ? " is-closing" : ""}`} role="dialog" aria-modal>
          <button type="button" className="home-sheet__backdrop" onClick={closeSheet} />
          <div className="home-sheet__panel">
            <div className="home-sheet__handle" />
            <strong className="home-sheet__title">{editing ? "일정 수정" : "새 일정 추가"}</strong>
            <form className="page-form dday-form" onSubmit={submit}>
              <label>
                여행명
                <input
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="예: 제주 1주년"
                  required
                />
              </label>
              <label>
                날짜
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  required
                />
              </label>
              <label>
                도시 (선택)
                <select
                  value={cityId}
                  onChange={(e) => setCityId(e.target.value)}
                  aria-label="도시"
                >
                  <option value="">—</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name_ko}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                유형
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  aria-label="이벤트 유형"
                >
                  {eventTypes.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                여행기간/메모
                <input value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
              <div className="dday-form__alarm">
                <label className="page-check">
                  <input type="checkbox" checked={n30} onChange={(e) => setN30(e.target.checked)} />
                  D-30일
                </label>
                <label className="page-check">
                  <input type="checkbox" checked={n7} onChange={(e) => setN7(e.target.checked)} />
                  D-7일
                </label>
                <label className="page-check">
                  <input type="checkbox" checked={n1} onChange={(e) => setN1(e.target.checked)} />
                  D-1일
                </label>
              </div>
              <button type="submit" className="page-btn page-btn--primary dday-form__submit">
                {editing ? "저장" : "추가"}
              </button>
              {editing ? (
                <button
                  type="button"
                  className="page-btn page-btn--ghost dday-form__submit"
                  onClick={closeSheet}
                >
                  취소
                </button>
              ) : null}
            </form>
            <button type="button" className="home-sheet__close" onClick={closeSheet}>
              닫기
            </button>
          </div>
        </div>
      )}

      <div className="dday-page__footer">
        <span>{user.email}</span>
        <button type="button" className="page-btn page-btn--ghost" onClick={signOut}>
          로그아웃
        </button>
      </div>
    </article>
  );
}

function DdayListSkeleton() {
  return (
    <section
      className="home-section dday-list dday-skeleton__list"
      aria-hidden="true"
    >
      {Array.from({ length: 3 }).map((_, idx) => (
        <article
          key={idx}
          className="dday-card home-place-card dday-skeleton__card"
        >
          <div className="home-place-card__body">
            <div className="dday-skeleton__title" />
            <div className="dday-skeleton__desc" />
            <div className="dday-skeleton__alarm-row">
              <div className="dday-skeleton__alarm" />
              <div className="dday-skeleton__alarm" />
              <div className="dday-skeleton__alarm" />
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}

function DdayPageSkeleton() {
  return (
    <>
      <section
        className="home-section prod-hero dday-skeleton__hero"
        aria-hidden="true"
      >
        <div className="dday-skeleton__hero-title" />
        <div className="dday-skeleton__hero-desc" />
      </section>

      <section
        className="home-section dday-page__filters dday-skeleton__filters"
        aria-hidden="true"
      >
        <div className="dday-filter-tabs">
          <div className="dday-skeleton__chip" />
          <div className="dday-skeleton__chip" />
          <div className="dday-skeleton__chip" />
        </div>
        <div className="dday-skeleton__add-btn" />
      </section>

      <DdayListSkeleton />
    </>
  );
}
