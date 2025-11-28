export interface IStadisticsReport {
  short_code: string;
  original_url: string;
  total_visits_ever: number;
  current_report_summary: string;
  visits_in_report_period: number;
  visits_by_day: { [date: string]: number }; // Ejemplo: { "2025-11-27": 15, "2025-11-28": 10 }
}
