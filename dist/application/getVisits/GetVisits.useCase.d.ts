import { IStadisticsReport } from "../../domain/interfaces/IStadisticsReport";
import { GetVisitsParams } from "../../domain/interfaces/IVisitParams";
import { IStadisticsService } from "../../domain/service/IStadistics.service";
export declare class GetVisitsUseCase {
    private stadisticsService;
    constructor(stadisticsService: IStadisticsService);
    execute({ shortCode, startDate, endDate, }: GetVisitsParams): Promise<IStadisticsReport | null>;
}
