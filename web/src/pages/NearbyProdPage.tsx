import { useEffect, useMemo, useState } from "react";
import { NaverNearbyMap } from "../components/NaverNearbyMap";
import { NearbyGsScore } from "../components/NearbyGsScore";
import { PageStatus } from "../components/PageStatus";
import { useCities } from "../hooks/useCities";
import { syncNearbyPlaces } from "../lib/nearbySync";
import { supabase } from "../lib/supabaseClient";
import { PAGE_STATUS_COPY } from "../ui/pageStatus";
import "./pages.css";

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

function isMissingColumnError(err: { message?: string } | null | undefined) {
  const m = err?.message ?? "";
  return m.toLowerCase().includes("column") && m.includes("does not exist");
}

function normalizeNearbyCategory(raw: string | null | undefined) {
  const val = (raw ?? "").toLowerCase().trim();
  if (!val) return "기타";
  if (/맛집|음식|food|restaurant|cafe|카페/.test(val)) return "맛집";
  if (/자연|공원|park|trail|hiking|산|숲|해변|beach/.test(val)) return "자연";
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
      <section
        className="home-hero prod-hero nearby-skeleton"
        aria-hidden="true"
      >
        <div className="nearby-skeleton__brand" />
        <div className="nearby-skeleton__title" />
        <div className="nearby-skeleton__title nearby-skeleton__title--short" />
        <div className="nearby-skeleton__desc" />
      </section>
      <section
        className="home-section nearby-section nearby-skeleton"
        aria-hidden="true"
      >
        <div className="nearby-skeleton__tabs" />
        <div className="nearby-skeleton__card" />
        <div className="nearby-skeleton__card" />
        <div className="nearby-skeleton__card" />
      </section>
      <section
        className="home-section nearby-section nearby-skeleton"
        aria-hidden="true"
      >
        <div className="nearby-skeleton__map-title" />
        <div className="nearby-skeleton__map" />
      </section>
    </>
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
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesErr, setPlacesErr] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<string>("전체");
  const [selectedPlaceTitle, setSelectedPlaceTitle] = useState<string | null>(
    null,
  );
  const [mapAuthError, setMapAuthError] = useState<string | null>(null);

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
    return [
      { key: "전체", label: "전체" },
      ...labels.map((label) => ({ key: label, label })),
    ];
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
  const showNearbySkeleton =
    citiesLoading || (placesLoading && places.length === 0);

  useEffect(() => {
    setMapAuthError(null);
  }, [cityId, naverMapClientId]);

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

  if (showNearbySkeleton && !citiesError) {
    return (
      <article className="home-page prod-page">
        <NearbyLoadingSkeleton />
      </article>
    );
  }

  return (
    <article className="home-page prod-page">
      <section className="home-hero prod-hero">
        <h2 className="prod-hero__title prod-hero__title--nearby">
          <span>{selectedCityName || nearest?.name_ko || "근처"}</span>에서
          <br />
          지금 뭐하면 좋을까?
        </h2>
        <p className="prod-hero__desc prod-hero__desc--nearby">
          오늘 {selectedCityName || nearest?.name_ko || "이 지역"}의 날씨를
          반영해 지금 가기 좋은 장소를 추천해요.
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

        {placesErr ? <PageStatus variant="error" /> : null}
        {!placesLoading && !placesErr && places.length === 0 ? (
          <PageStatus
            variant="empty"
            message="주변 추천 데이터가 아직 없어요. 잠시 후 다시 시도해 주세요."
          />
        ) : null}

        {!placesLoading && !placesErr && places.length ? (
          <>
            <div
              className="nearby-activity-tabs"
              role="tablist"
              aria-label="추천 활동 탭"
            >
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
                    ? distanceKm(
                        mapCenter.lat,
                        mapCenter.lon,
                        place.lat,
                        place.lon,
                      )
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
        {mapAuthError ? (
          <PageStatus
            variant="error"
            message={`네이버 지도 인증에 실패했어요. Client ID와 Web 서비스 URL(origin: localhost/127.0.0.1/배포 도메인) 설정을 다시 확인해 주세요. 상세: ${mapAuthError}`}
          />
        ) : null}
        {mapCenter ? (
          naverMapClientId ? (
            <NaverNearbyMap
              clientId={naverMapClientId}
              center={mapCenter}
              markers={mapMarkers}
              selectedMarkerTitle={selectedPlaceTitle}
              onError={setMapAuthError}
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
