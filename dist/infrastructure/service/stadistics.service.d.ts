import { IStadisticsService } from "../../domain/service/IStadistics.service";
import { ILink } from "../../domain/interfaces/ILink";
export declare class StadisticsService implements IStadisticsService {
    getLinkByShortCode(shortCode: string): Promise<ILink | null>;
}
