import type { CityRow } from '../hooks/useCities'
import { ProdField } from './ProdPageChrome'

export function CityPicker({
  cities,
  cityId,
  setCityId,
  onUserPick,
}: {
  cities: CityRow[]
  cityId: string
  setCityId: (v: string) => void
  onUserPick?: () => void
}) {
  return (
    <ProdField label="도시">
      <select
        className="page-select"
        value={cityId}
        onChange={(e) => {
          onUserPick?.()
          setCityId(e.target.value)
        }}
      >
        {cities.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name_ko}
          </option>
        ))}
      </select>
    </ProdField>
  )
}
