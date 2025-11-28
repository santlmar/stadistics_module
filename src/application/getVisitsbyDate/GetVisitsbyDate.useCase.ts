import { IStadisticsReport } from "../../domain/interfaces/IStadisticsReport";
import { GetVisitsParams } from "../../domain/interfaces/IVisitParams";
import { IStadisticsService } from "../../domain/service/IStadistics.service";
import { GetVisitsUseCase } from "../getVisits/GetVisits.useCase";

export class GetVisitsbyDateUseCase {
  private getVisitsUseCase: GetVisitsUseCase;

  constructor(stadisticsService: IStadisticsService) {
    // Inicializa el caso de uso real que contiene la lógica
    this.getVisitsUseCase = new GetVisitsUseCase(stadisticsService);
  }

  public async execute(
    params: GetVisitsParams
  ): Promise<IStadisticsReport | null> {
    // Delega la ejecución al caso de uso principal
    return this.getVisitsUseCase.execute(params);
  }
}
