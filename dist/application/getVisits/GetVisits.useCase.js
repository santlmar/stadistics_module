"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetVisitsUseCase = void 0;
const isDateInRange = (visitTimestamp, start, end) => {
    try {
        const visitDate = new Date(visitTimestamp);
        visitDate.setUTCHours(0, 0, 0, 0);
        const startCheck = start ? visitDate.getTime() >= start.getTime() : true;
        const endCheck = end ? visitDate.getTime() <= end.getTime() : true;
        return startCheck && endCheck;
    }
    catch (e) {
        console.error("Error processing timestamp:", visitTimestamp, e);
        return false;
    }
};
class GetVisitsUseCase {
    constructor(stadisticsService) {
        this.stadisticsService = stadisticsService;
    }
    async execute({ shortCode, startDate, endDate, }) {
        const link = await this.stadisticsService.getLinkByShortCode(shortCode);
        if (!link) {
            return null;
        }
        const allVisits = link.visits || [];
        let startFilter;
        let endFilter;
        let filterSummary = "Total visits";
        try {
            if (startDate) {
                startFilter = new Date(startDate);
                startFilter.setUTCHours(0, 0, 0, 0);
            }
            if (endDate) {
                endFilter = new Date(endDate);
                endFilter.setUTCHours(23, 59, 59, 999);
            }
        }
        catch (e) {
            throw new Error("Invalid date format. Expected YYYY-MM-DD.");
        }
        let visitsToReport = allVisits;
        if (startFilter || endFilter) {
            visitsToReport = allVisits.filter((visit) => isDateInRange(visit, startFilter, endFilter));
            if (startFilter && endFilter) {
                filterSummary = `Visits between ${startDate} and ${endDate}`;
            }
            else if (startFilter) {
                filterSummary = `Visits from ${startDate} onwards`;
            }
            else if (endFilter) {
                filterSummary = `Visits up to ${endDate}`;
            }
        }
        const visitsByDay = {};
        visitsToReport.forEach((visitTimestamp) => {
            const visitDay = visitTimestamp.substring(0, 10);
            visitsByDay[visitDay] = (visitsByDay[visitDay] || 0) + 1;
        });
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
exports.GetVisitsUseCase = GetVisitsUseCase;
//# sourceMappingURL=GetVisits.useCase.js.map