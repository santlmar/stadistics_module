"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetVisitsbyDateUseCase = void 0;
const GetVisits_useCase_1 = require("../getVisits/GetVisits.useCase");
class GetVisitsbyDateUseCase {
    constructor(stadisticsService) {
        this.getVisitsUseCase = new GetVisits_useCase_1.GetVisitsUseCase(stadisticsService);
    }
    async execute(params) {
        return this.getVisitsUseCase.execute(params);
    }
}
exports.GetVisitsbyDateUseCase = GetVisitsbyDateUseCase;
//# sourceMappingURL=GetVisitsbyDate.useCase.js.map