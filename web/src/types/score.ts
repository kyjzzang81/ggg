export type WeekScore = {
  week_of_year: number;
  travel_score: number | null;
  temp_score: number | null;
  rain_score: number | null;
  humidity_score?: number | null;
};
