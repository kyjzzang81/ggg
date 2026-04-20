import { supabase } from "./supabaseClient";

export type NearbySyncResult = {
  ok: boolean;
  skipped?: boolean;
  upserted?: number;
  error?: string;
};

export async function syncNearbyPlaces(
  cityId: string,
  weather: string[] = [],
): Promise<NearbySyncResult> {
  if (!supabase || !cityId) return { ok: false, error: "supabase/city_id missing" };
  const { data, error } = await supabase.functions.invoke("nearby-sync", {
    body: { city_id: cityId, weather },
  });
  if (error) return { ok: false, error: error.message };
  const payload = (data ?? {}) as NearbySyncResult;
  if (payload.error) return { ok: false, error: payload.error };
  return { ok: true, skipped: payload.skipped, upserted: payload.upserted };
}
