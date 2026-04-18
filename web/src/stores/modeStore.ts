import { useMemo, useSyncExternalStore } from 'react'

export type ThemeIntensity = 'full' | 'soft' | 'accent-only'

const STORAGE_KEY = 'ggg.mode'
/** 이전 브랜딩 키 — 읽기만 하며, 저장 시 `STORAGE_KEY`로 이전 후 제거한다. */
const LEGACY_STORAGE_KEY = 'climate.mode'
const STORAGE_VERSION = 1

export type ModeState = {
  couple: boolean
  family: boolean
  themeIntensity: ThemeIntensity
}

type ModeListener = () => void

const listeners = new Set<ModeListener>()

let snapshot: ModeState = {
  couple: false,
  family: false,
  themeIntensity: 'soft',
}

function emit() {
  for (const l of listeners) l()
}

function readFromStorage(): ModeState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw =
      window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { state?: Partial<ModeState>; version?: number }
    if (parsed?.version !== STORAGE_VERSION) return null
    const s = parsed.state ?? {}
    return {
      couple: Boolean(s.couple),
      family: Boolean(s.family),
      themeIntensity: (s.themeIntensity as ThemeIntensity) ?? 'soft',
    }
  } catch {
    return null
  }
}

const hydratedSnapshot = readFromStorage()
if (hydratedSnapshot) snapshot = hydratedSnapshot

if (
  typeof window !== 'undefined' &&
  hydratedSnapshot &&
  !window.localStorage.getItem(STORAGE_KEY) &&
  window.localStorage.getItem(LEGACY_STORAGE_KEY)
) {
  writeToStorage(hydratedSnapshot)
}

function writeToStorage(next: ModeState) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: STORAGE_VERSION, state: next }),
    )
    try {
      window.localStorage.removeItem(LEGACY_STORAGE_KEY)
    } catch {
      // ignore
    }
  } catch {
    // ignore quota / private mode
  }
}

function setMode(partial: Partial<ModeState>) {
  snapshot = { ...snapshot, ...partial }
  writeToStorage(snapshot)
  emit()
}

export function getModeSnapshot(): ModeState {
  return snapshot
}

export function initModeStoreFromStorage() {
  const from = readFromStorage()
  if (from) {
    snapshot = from
    emit()
  }
}

export function setCouple(v: boolean) {
  setMode({ couple: v })
}

export function setFamily(v: boolean) {
  setMode({ family: v })
}

export function toggleCouple() {
  setMode({ couple: !snapshot.couple })
}

export function toggleFamily() {
  setMode({ family: !snapshot.family })
}

export function setThemeIntensity(v: ThemeIntensity) {
  setMode({ themeIntensity: v })
}

export function resetMode() {
  setMode({ couple: false, family: false, themeIntensity: 'soft' })
}

export function subscribeMode(listener: ModeListener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getModeServerSnapshot(): ModeState {
  return {
    couple: false,
    family: false,
    themeIntensity: 'soft',
  }
}

export function useModeStore(): ModeState & {
  setCouple: (v: boolean) => void
  setFamily: (v: boolean) => void
  toggleCouple: () => void
  toggleFamily: () => void
  setThemeIntensity: (v: ThemeIntensity) => void
  reset: () => void
} {
  const state = useSyncExternalStore(subscribeMode, getModeSnapshot, getModeServerSnapshot)

  const api = useMemo(
    () => ({
      setCouple,
      setFamily,
      toggleCouple,
      toggleFamily,
      setThemeIntensity,
      reset: resetMode,
    }),
    [],
  )

  return useMemo(() => ({ ...state, ...api }), [api, state])
}

export const selectLayerFlags = (s: ModeState) => ({ couple: s.couple, family: s.family })
export const selectHasAnyLayer = (s: ModeState) => s.couple || s.family
