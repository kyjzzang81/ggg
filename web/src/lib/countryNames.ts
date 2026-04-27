const COUNTRY_KO: Record<string, string> = {
  KR: "대한민국",
  JP: "일본",
  CN: "중국",
  TW: "대만",
  HK: "홍콩",
  MO: "마카오",
  TH: "태국",
  VN: "베트남",
  PH: "필리핀",
  ID: "인도네시아",
  MY: "말레이시아",
  SG: "싱가포르",
  IN: "인도",
  AE: "아랍에미리트",
  TR: "튀르키예",
  US: "미국",
  CA: "캐나다",
  MX: "멕시코",
  BR: "브라질",
  AR: "아르헨티나",
  CL: "칠레",
  PE: "페루",
  GB: "영국",
  FR: "프랑스",
  DE: "독일",
  IT: "이탈리아",
  ES: "스페인",
  PT: "포르투갈",
  NL: "네덜란드",
  BE: "벨기에",
  CH: "스위스",
  AT: "오스트리아",
  CZ: "체코",
  PL: "폴란드",
  HU: "헝가리",
  GR: "그리스",
  SE: "스웨덴",
  NO: "노르웨이",
  FI: "핀란드",
  DK: "덴마크",
  IS: "아이슬란드",
  IE: "아일랜드",
  RU: "러시아",
  AU: "호주",
  NZ: "뉴질랜드",
  EG: "이집트",
  ZA: "남아프리카공화국",
  MA: "모로코",
};

const COUNTRY_EN: Record<string, string> = {
  KR: "korea",
  JP: "japan",
  CN: "china",
  TW: "taiwan",
  HK: "hong kong",
  MO: "macao",
  TH: "thailand",
  VN: "vietnam",
  PH: "philippines",
  ID: "indonesia",
  MY: "malaysia",
  SG: "singapore",
  IN: "india",
  AE: "united arab emirates",
  TR: "turkiye",
  US: "united states",
  CA: "canada",
  MX: "mexico",
  BR: "brazil",
  AR: "argentina",
  CL: "chile",
  PE: "peru",
  GB: "united kingdom",
  FR: "france",
  DE: "germany",
  IT: "italy",
  ES: "spain",
  PT: "portugal",
  NL: "netherlands",
  BE: "belgium",
  CH: "switzerland",
  AT: "austria",
  CZ: "czech republic",
  PL: "poland",
  HU: "hungary",
  GR: "greece",
  SE: "sweden",
  NO: "norway",
  FI: "finland",
  DK: "denmark",
  IS: "iceland",
  IE: "ireland",
  RU: "russia",
  AU: "australia",
  NZ: "new zealand",
  EG: "egypt",
  ZA: "south africa",
  MA: "morocco",
};

const COUNTRY_ALIASES: Record<string, string[]> = {
  KR: ["south korea", "republic of korea", "korea", "rok"],
  US: ["usa", "u.s.", "u.s.a.", "america", "united states of america"],
  GB: ["uk", "u.k.", "britain", "great britain", "england"],
  AE: ["uae", "u.a.e."],
  RU: ["russian federation"],
  CZ: ["czechia"],
};

export function countryKo(code: string | null | undefined): string {
  if (!code) return "";
  const upper = code.toUpperCase();
  return COUNTRY_KO[upper] ?? upper;
}

export function countryEn(code: string | null | undefined): string {
  if (!code) return "";
  const upper = code.toUpperCase();
  return COUNTRY_EN[upper] ?? upper.toLowerCase();
}

export function countryAliasEn(code: string | null | undefined): string[] {
  if (!code) return [];
  const upper = code.toUpperCase();
  return COUNTRY_ALIASES[upper] ?? [];
}
