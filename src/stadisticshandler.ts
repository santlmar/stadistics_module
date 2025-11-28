import { GetVisitsUseCase } from "./application/getVisits/GetVisits.useCase";
import { IStadisticsReport } from "./domain/interfaces/IStadisticsReport";
import { StadisticsService } from "./infrastructure/service/stadistics.service";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

// 1. Inicialización de dependencias (fuera del handler para reutilizar en frío)
const stadisticsService = new StadisticsService();
const getVisitsUseCase = new GetVisitsUseCase(stadisticsService);
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Permitir acceso desde cualquier origen
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET",
  "Content-Type": "application/json",
  "Cache-Control": "no-cache",
};
/**
 * Función manejadora principal de AWS Lambda (Controller).
 * Responde a la ruta GET /stats/{codigo}.
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  // Extracción de parámetros de ruta y query string
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
    // 2. Llamada al Caso de Uso de Aplicación
    const report: IStadisticsReport | null = await getVisitsUseCase.execute({
      shortCode,
      startDate,
      endDate,
    });

    // 3. Manejo de respuesta
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
  } catch (error) {
    console.error("Error in Stadistics Controller:", error);

    // 4. Manejo de Errores de Dominio/Infraestructura
    let statusCode = 500;
    let errorMessage = "Internal Server Error";

    if (
      error instanceof Error &&
      error.message.includes("Invalid date format")
    ) {
      statusCode = 400;
      errorMessage = error.message;
    }
    // Se pueden añadir más catch blocks para errores específicos de negocio

    return {
      statusCode: statusCode,
      headers: corsHeaders,
      body: JSON.stringify({ message: errorMessage }),
    };
  }
}

// Nota: En un entorno real de Typescript/Node para Lambda,
// el 'handler' debe ser exportado y apuntado por la configuración de la función Lambda.
