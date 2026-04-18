import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { MainLayout } from './layouts/MainLayout'
import { HomeProdPage } from './pages/HomeProdPage'
import { DdayPage } from './pages/DdayPage'
import { MissionPage } from './pages/MissionPage'
import { AuthCallback } from './pages/AuthCallback'
import {
  CompareProdPage,
  HiddenSeasonProdPage,
  ImpactProdPage,
  MyPageProd,
  NearbyProdPage,
  PlaceProdPage,
  ScoreProdPage,
} from './pages/ProductionPages'
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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route element={<MainLayout />}>
          <Route path="/" element={<HomeProdPage />} />
          <Route path="/score" element={<ScoreProdPage />} />
          <Route path="/place" element={<PlaceProdPage />} />
          <Route path="/nearby" element={<NearbyProdPage />} />
          <Route path="/dday" element={<DdayPage />} />
          <Route path="/mission" element={<MissionPage />} />
          <Route path="/hidden-season" element={<HiddenSeasonProdPage />} />
          <Route path="/compare" element={<CompareProdPage />} />
          <Route path="/impact" element={<ImpactProdPage />} />
          <Route path="/mypage" element={<MyPageProd />} />
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
