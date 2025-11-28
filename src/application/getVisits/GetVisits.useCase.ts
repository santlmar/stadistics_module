import { IStadisticsReport } from "../../domain/interfaces/IStadisticsReport";
import { GetVisitsParams } from "../../domain/interfaces/IVisitParams";
import { IStadisticsService } from "../../domain/service/IStadistics.service";

const isDateInRange = (
  visitTimestamp: string,
  start?: Date,
  end?: Date
): boolean => {
  try {
    const visitDate = new Date(visitTimestamp);
    visitDate.setUTCHours(0, 0, 0, 0);

    const startCheck = start ? visitDate.getTime() >= start.getTime() : true;
    const endCheck = end ? visitDate.getTime() <= end.getTime() : true;

    return startCheck && endCheck;
  } catch (e) {
    console.error("Error processing timestamp:", visitTimestamp, e);
    return false;
  }
};

export class GetVisitsUseCase {
  private stadisticsService: IStadisticsService;

  constructor(stadisticsService: IStadisticsService) {
    this.stadisticsService = stadisticsService;
  }

  public async execute({
    shortCode,
    startDate,
    endDate,
  }: GetVisitsParams): Promise<IStadisticsReport | null> {
    const link = await this.stadisticsService.getLinkByShortCode(shortCode);

    if (!link) {
      return null;
    }

    const allVisits = link.visits || [];

    // 2. Preparar fechas para el filtro
    let startFilter: Date | undefined;
    let endFilter: Date | undefined;
    let filterSummary = "Total visits";

    try {
      if (startDate) {
        // Parsear la fecha de inicio
        startFilter = new Date(startDate);
        startFilter.setUTCHours(0, 0, 0, 0); // Establecer al inicio del día
      }
      if (endDate) {
        // Parsear la fecha de fin
        endFilter = new Date(endDate);
        // Establecer al final del día para incluir todas las visitas de ese día
        endFilter.setUTCHours(23, 59, 59, 999);
      }
    } catch (e) {
      // Manejar errores de formato de fecha
      throw new Error("Invalid date format. Expected YYYY-MM-DD.");
    }

    // 3. Filtrar las visitas
    let visitsToReport: string[] = allVisits;

    if (startFilter || endFilter) {
      visitsToReport = allVisits.filter((visit) =>
        isDateInRange(visit, startFilter, endFilter)
      );

      // Construir el resumen del filtro
      if (startFilter && endFilter) {
        filterSummary = `Visits between ${startDate} and ${endDate}`;
      } else if (startFilter) {
        filterSummary = `Visits from ${startDate} onwards`;
      } else if (endFilter) {
        filterSummary = `Visits up to ${endDate}`;
      }
    }

    // 4. Agrupar visitas por día
    const visitsByDay: { [date: string]: number } = {};
    visitsToReport.forEach((visitTimestamp) => {
      // Usamos substring(0, 10) para obtener 'YYYY-MM-DD'
      const visitDay = visitTimestamp.substring(0, 10);
      visitsByDay[visitDay] = (visitsByDay[visitDay] || 0) + 1;
    });

    // 5. Devolver el Reporte
    return {
      short_code: link.short_code,
      original_url: link.original_url,
      total_visits_ever: allVisits.length,
      current_report_summary: filterSummary,
      visits_in_report_period: visitsToReport.length,
      visits_by_day: visitsByDay,
    };
  }
}
