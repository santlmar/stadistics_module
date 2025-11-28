import { ILink } from "../interfaces/ILink";

export interface IStadisticsService {
  getLinkByShortCode(shortCode: string): Promise<ILink | null>;
}
