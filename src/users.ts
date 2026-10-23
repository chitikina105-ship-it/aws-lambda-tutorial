
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyHandler,
  APIGatewayProxyResult,
} from "aws-lambda";

import { randomUUID } from "node:crypto";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

interface User {
  id: string;
  name: string;
  email: string;
}

const client = new DynamoDBClient({});

const dynamoDB = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME ?? "Users";

const handleRequest = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  console.log("Invoked Lambda:", event.httpMethod, event.path);

  const method = event.httpMethod;
  const id = event.pathParameters?.id;

  try {
    // GET /users
    if (method === "GET" && !id) {
      const result = await dynamoDB.send(
        new ScanCommand({
          TableName: TABLE_NAME,
        }),
      );

      return {
        statusCode: 200,
        body: JSON.stringify(result.Items ?? []),
      };
    }

    // GET /users/{id}
    if (method === "GET" && id) {
      const result = await dynamoDB.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: { id },
        }),
      );

      return result.Item
        ? {
            statusCode: 200,
            body: JSON.stringify(result.Item),
          }
        : {
            statusCode: 404,
            body: JSON.stringify({ message: "User not found" }),
          };
    }

    // POST /users
    if (method === "POST") {
      const body = JSON.parse(event.body ?? "{}");

      if (!body.name || !body.email) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            message: "Name and email are required",
          }),
        };
      }

      const newUser: User = {
        id: randomUUID(),
        name: body.name,
        email: body.email,
      };

      await dynamoDB.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: newUser,
        }),
      );

      return {
        statusCode: 201,
        body: JSON.stringify(newUser),
      };
    }

    // PUT /users/{id}
    if (method === "PUT" && id) {
      const body = JSON.parse(event.body ?? "{}");

      if (!body.name && !body.email) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            message: "Provide name or email to update",
          }),
        };
      }

      const existing = await dynamoDB.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: { id },
        }),
      );

      if (!existing.Item) {
        return {
          statusCode: 404,
          body: JSON.stringify({ message: "User not found" }),
        };
      }

      const result = await dynamoDB.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { id },
          UpdateExpression: "SET #name = if_not_exists(#name, :empty), #email = if_not_exists(#email, :empty)",
          ExpressionAttributeNames: {
            "#name": "name",
            "#email": "email",
          },
          ExpressionAttributeValues: {
            ":empty": "",
          },
          ReturnValues: "ALL_NEW",
        }),
      );

      // Apply only the fields supplied by the client.
      const updatedUser: User = {
        ...(existing.Item as User),
        ...(body.name ? { name: body.name } : {}),
        ...(body.email ? { email: body.email } : {}),
      };

      await dynamoDB.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: updatedUser,
        }),
      );

      return {
        statusCode: 200,
        body: JSON.stringify(updatedUser),
      };
    }

    // DELETE /users/{id}
    if (method === "DELETE" && id) {
      const result = await dynamoDB.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: { id },
          ReturnValues: "ALL_OLD",
        }),
      );

      if (!result.Attributes) {
        return {
          statusCode: 404,
          body: JSON.stringify({ message: "User not found" }),
        };
      }

      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "User deleted",
          user: result.Attributes,
        }),
      };
    }

    return {
      statusCode: 405,
      body: JSON.stringify({
        message: "Method not supported for this route",
      }),
    };
  } catch (error) {
    console.error("CRUD operation failed:", error);

    if (error instanceof SyntaxError) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Invalid request body" }),
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};

export const handler: APIGatewayProxyHandler = async (event) => {
  const response = await handleRequest(event);

  return {
    ...response,
    headers: {
      ...response.headers,
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  };
};
