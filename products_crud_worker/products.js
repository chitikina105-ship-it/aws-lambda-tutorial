
const { randomUUID } = require("node:crypto");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand
} = require("@aws-sdk/lib-dynamodb");

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.PRODUCTS_TABLE;

const response = (statusCode, data) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE"
  },
  body: data === undefined ? "" : JSON.stringify(data)
});

exports.handler = async (event) => {
  const method = event.httpMethod;
  const id = event.pathParameters?.id;

  if (method === "OPTIONS") return response(204);

  try {
    if (method === "POST" && !id) {
      let body;
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return response(400, { message: "Invalid JSON" });
      }

      if (!body.name?.trim() || !Number.isFinite(Number(body.price)) ||
          Number(body.price) < 0) {
        return response(400, {
          message: "name and a non-negative price are required"
        });
      }

      const now = new Date().toISOString();
      const product = {
        id: randomUUID(),
        name: body.name.trim(),
        price: Number(body.price),
        description: body.description || "",
        createdAt: now,
        updatedAt: now
      };

      await db.send(new PutCommand({
        TableName: TABLE,
        Item: product
      }));

      return response(201, product);
    }

    if (method === "GET" && !id) {
      const result = await db.send(new ScanCommand({ TableName: TABLE }));
      return response(200, { items: result.Items || [] });
    }

    if (method === "GET" && id) {
      const result = await db.send(new GetCommand({
        TableName: TABLE,
        Key: { id }
      }));
      return result.Item
        ? response(200, result.Item)
        : response(404, { message: "Product not found" });
    }

    if (method === "PUT" && id) {
      let body;
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return response(400, { message: "Invalid JSON" });
      }

      if (!body.name?.trim() || !Number.isFinite(Number(body.price)) ||
          Number(body.price) < 0) {
        return response(400, {
          message: "name and a non-negative price are required"
        });
      }

      const result = await db.send(new UpdateCommand({
        TableName: TABLE,
        Key: { id },
        UpdateExpression:
          "SET #name = :name, price = :price, description = :description, updatedAt = :updatedAt",
        ConditionExpression: "attribute_exists(id)",
        ExpressionAttributeNames: { "#name": "name" },
        ExpressionAttributeValues: {
          ":name": body.name.trim(),
          ":price": Number(body.price),
          ":description": body.description || "",
          ":updatedAt": new Date().toISOString()
        },
        ReturnValues: "ALL_NEW"
      }));

      return response(200, result.Attributes);
    }

    if (method === "DELETE" && id) {
      await db.send(new DeleteCommand({
        TableName: TABLE,
        Key: { id },
        ConditionExpression: "attribute_exists(id)"
      }));
      return response(200, { message: "Product deleted", id });
    }

    return response(404, { message: "Route not found" });
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") {
      return response(404, { message: "Product not found" });
    }
    console.error(error);
    return response(500, { message: "Internal server error" });
  }
};
