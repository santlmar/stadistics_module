import { IStadisticsService } from "../../domain/service/IStadistics.service";
import { ILink } from "../../domain/interfaces/ILink";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

// Configuración de AWS
const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || "short_links";
const REGION = process.env.AWS_REGION || "us-east-2";

// Inicialización de la base de datos
const client = new DynamoDBClient({ region: REGION });
const ddbDocClient = DynamoDBDocumentClient.from(client);

/**
 * Implementación del servicio de estadísticas utilizando AWS DynamoDB.
 * Cumple con el contrato IStadisticsService.
 */
export class StadisticsService implements IStadisticsService {
  public async getLinkByShortCode(shortCode: string): Promise<ILink | null> {
    const params = {
      TableName: DYNAMODB_TABLE_NAME,
      Key: {
        id: shortCode,
      },
    };

    try {
      const data = await ddbDocClient.send(new GetCommand(params));

      // Si el Item existe, lo casteamos a ILink
      if (data.Item) {
        // Nota: DynamoDB almacena la lista 'visits' como una lista de strings
        return data.Item as ILink;
      }

      return null;
    } catch (error) {
      console.error("Error al obtener el link de DynamoDB:", error);
      // Re-lanzar un error de infraestructura para ser manejado por el Controller
      throw new Error("Database access failed during link retrieval.");
    }
  }
}
