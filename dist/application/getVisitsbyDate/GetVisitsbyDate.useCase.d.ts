import { IStadisticsReport } from "../../domain/interfaces/IStadisticsReport";
import { GetVisitsParams } from "../../domain/interfaces/IVisitParams";
import { IStadisticsService } from "../../domain/service/IStadistics.service";
export declare class GetVisitsbyDateUseCase {
    private getVisitsUseCase;
    constructor(stadisticsService: IStadisticsService);
    execute(params: GetVisitsParams): Promise<IStadisticsReport | null>;
}
