import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { MainLayout } from './layouts/MainLayout'
import { HomeProdPage } from './pages/HomeProdPage'
import { DdayPage } from './pages/DdayPage'
import { MissionPage } from './pages/MissionPage'
import { AuthCallback } from './pages/AuthCallback'
import { PageStatus } from './components/PageStatus'
import {
  ComparePage,
  HiddenSeasonPage,
  ImpactPage,
  MyPage,
  NearbyPage,
  PlacePage,
  ScorePage,
  TestDataHomePage,
} from './pages/MvpDataPages'

const ScoreProdPage = lazy(() =>
  import('./pages/ScoreProdPage').then((m) => ({ default: m.ScoreProdPage })),
)
const PlaceProdPage = lazy(() =>
  import('./pages/PlaceProdPage').then((m) => ({ default: m.PlaceProdPage })),
)
const NearbyProdPage = lazy(() =>
  import('./pages/NearbyProdPage').then((m) => ({ default: m.NearbyProdPage })),
)
const HiddenSeasonProdPage = lazy(() =>
  import('./pages/HiddenSeasonProdPage').then((m) => ({
    default: m.HiddenSeasonProdPage,
  })),
)
const CompareProdPage = lazy(() =>
  import('./pages/CompareProdPage').then((m) => ({
    default: m.CompareProdPage,
  })),
)
const ImpactProdPage = lazy(() =>
  import('./pages/ImpactProdPage').then((m) => ({ default: m.ImpactProdPage })),
)
const MyPageProd = lazy(() =>
  import('./pages/MyPageProd').then((m) => ({ default: m.MyPageProd })),
)

function ProdPageFallback() {
  return (
    <article className="home-page prod-page">
      <PageStatus variant="loading" />
    </article>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route element={<MainLayout />}>
          <Route path="/" element={<HomeProdPage />} />
          <Route
            path="/score"
            element={
              <Suspense fallback={<ProdPageFallback />}>
                <ScoreProdPage />
              </Suspense>
            }
          />
          <Route
            path="/place"
            element={
              <Suspense fallback={<ProdPageFallback />}>
                <PlaceProdPage />
              </Suspense>
            }
          />
          <Route
            path="/nearby"
            element={
              <Suspense fallback={<ProdPageFallback />}>
                <NearbyProdPage />
              </Suspense>
            }
          />
          <Route path="/dday" element={<DdayPage />} />
          <Route path="/mission" element={<MissionPage />} />
          <Route
            path="/hidden-season"
            element={
              <Suspense fallback={<ProdPageFallback />}>
                <HiddenSeasonProdPage />
              </Suspense>
            }
          />
          <Route
            path="/compare"
            element={
              <Suspense fallback={<ProdPageFallback />}>
                <CompareProdPage />
              </Suspense>
            }
          />
          <Route
            path="/impact"
            element={
              <Suspense fallback={<ProdPageFallback />}>
                <ImpactProdPage />
              </Suspense>
            }
          />
          <Route
            path="/mypage"
            element={
              <Suspense fallback={<ProdPageFallback />}>
                <MyPageProd />
              </Suspense>
            }
          />
        </Route>
        <Route path="/test-data" element={<TestDataHomePage />} />
        <Route path="/test-data/score" element={<ScorePage />} />
        <Route path="/test-data/place" element={<PlacePage />} />
        <Route path="/test-data/nearby" element={<NearbyPage />} />
        <Route path="/test-data/hidden-season" element={<HiddenSeasonPage />} />
        <Route path="/test-data/compare" element={<ComparePage />} />
        <Route path="/test-data/impact" element={<ImpactPage />} />
        <Route path="/test-data/mypage" element={<MyPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
