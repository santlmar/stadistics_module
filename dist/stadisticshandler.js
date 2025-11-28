"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = handler;
const GetVisits_useCase_1 = require("./application/getVisits/GetVisits.useCase");
const stadistics_service_1 = require("./infrastructure/service/stadistics.service");
const stadisticsService = new stadistics_service_1.StadisticsService();
const getVisitsUseCase = new GetVisits_useCase_1.GetVisitsUseCase(stadisticsService);
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET",
    "Content-Type": "application/json",
    "Cache-Control": "no-cache",
};
async function handler(event) {
    const shortCode = event.pathParameters?.linkId;
    const startDate = event.queryStringParameters?.start_date;
    const endDate = event.queryStringParameters?.end_date;
    if (!shortCode) {
        return {
            statusCode: 400,
            body: JSON.stringify({
                message: "Missing short code (codigo) in path parameters.",
            }),
        };
    }
    try {
        const report = await getVisitsUseCase.execute({
            shortCode,
            startDate,
            endDate,
        });
        if (!report) {
            return {
                statusCode: 404,
                body: JSON.stringify({
                    message: `Short URL with code ${shortCode} not found.`,
                }),
            };
        }
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify(report, null, 2),
        };
    }
    catch (error) {
        console.error("Error in Stadistics Controller:", error);
        let statusCode = 500;
        let errorMessage = "Internal Server Error";
        if (error instanceof Error &&
            error.message.includes("Invalid date format")) {
            statusCode = 400;
            errorMessage = error.message;
        }
        return {
            statusCode: statusCode,
            headers: corsHeaders,
            body: JSON.stringify({ message: errorMessage }),
        };
    }
}
//# sourceMappingURL=stadisticshandler.js.map