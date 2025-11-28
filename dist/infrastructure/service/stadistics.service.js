"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StadisticsService = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || "short_links";
const REGION = process.env.AWS_REGION || "us-east-2";
const client = new client_dynamodb_1.DynamoDBClient({ region: REGION });
const ddbDocClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
class StadisticsService {
    async getLinkByShortCode(shortCode) {
        const params = {
            TableName: DYNAMODB_TABLE_NAME,
            Key: {
                id: shortCode,
            },
        };
        try {
            const data = await ddbDocClient.send(new lib_dynamodb_1.GetCommand(params));
            if (data.Item) {
                return data.Item;
            }
            return null;
        }
        catch (error) {
            console.error("Error al obtener el link de DynamoDB:", error);
            throw new Error("Database access failed during link retrieval.");
        }
    }
}
exports.StadisticsService = StadisticsService;
//# sourceMappingURL=stadistics.service.js.map