
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyHandler,
  APIGatewayProxyResult,
} from "aws-lambda";
import logger from "./logger.js";

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
  const method = event.httpMethod;
  const id = event.pathParameters?.id;
  const requestContext = {
    method,
    path: event.path,
    requestId: event.requestContext.requestId,
  };

  logger.info("User request received", requestContext);

  try {
    // GET /users
    if (method === "GET" && !id) {
      logger.info("Listing users", requestContext);
      const result = await dynamoDB.send(
        new ScanCommand({
          TableName: TABLE_NAME,
        }),
      );
      logger.info("Users listed", {
        ...requestContext,
        count: result.Items?.length ?? 0,
      });
      return {
        statusCode: 200,
        body: JSON.stringify(result.Items ?? []),
      };
    }

    // GET /users/{id}
    if (method === "GET" && id) {
      logger.info("Getting user", { ...requestContext, userId: id });
      const result = await dynamoDB.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: { id },
        }),
      );

      if (result.Item) {
        logger.info("User retrieved", { ...requestContext, userId: id });
        return {
          statusCode: 200,
          body: JSON.stringify(result.Item),
        };
      }

      logger.warn("User not found", { ...requestContext, userId: id });
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "User not found" }),
      };
    }

    // POST /users
    if (method === "POST") {
      logger.info("Creating user", requestContext);
      const body = JSON.parse(event.body ?? "{}");

      if (!body.name || !body.email) {
        logger.warn("User creation rejected", {
          ...requestContext,
          reason: "Name and email are required",
        });
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
      logger.info("User created", { ...requestContext, userId: newUser.id });
      return {
        statusCode: 201,
        body: JSON.stringify(newUser),
      };
    }

    // PUT /users/{id}
    if (method === "PUT" && id) {
      logger.info("Updating user", { ...requestContext, userId: id });
      const body = JSON.parse(event.body ?? "{}");

      if (!body.name && !body.email) {
        logger.warn("User update rejected", {
          ...requestContext,
          userId: id,
          reason: "Provide name or email to update",
        });
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
        logger.warn("User not found", { ...requestContext, userId: id });
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

      logger.info("User updated", { ...requestContext, userId: id });
      return {
        statusCode: 200,
        body: JSON.stringify(updatedUser),
      };
    }

    // DELETE /users/{id}
    if (method === "DELETE" && id) {
      logger.info("Deleting user", { ...requestContext, userId: id });
      const result = await dynamoDB.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: { id },
          ReturnValues: "ALL_OLD",
        }),
      );

      if (!result.Attributes) {
        logger.warn("User not found", { ...requestContext, userId: id });
        return {
          statusCode: 404,
          body: JSON.stringify({ message: "User not found" }),
        };
      }

      logger.info("User deleted", { ...requestContext, userId: id });
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "User deleted",
          user: result.Attributes,
        }),
      };
    }

    logger.warn("Unsupported user route", requestContext);
    return {
      statusCode: 405,
      body: JSON.stringify({
        message: "Method not supported for this route",
      }),
    };
  } catch (error) {
    logger.error("User request failed", {
      ...requestContext,
      userId: id,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : error,
    });

    if (error instanceof SyntaxError) {
      logger.warn("Invalid request body", requestContext);
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
  logger.info("User request completed", {
    method: event.httpMethod,
    path: event.path,
    requestId: event.requestContext.requestId,
    statusCode: response.statusCode,
  });

  return {
    ...response,
    headers: {
      ...response.headers,
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  };
};
