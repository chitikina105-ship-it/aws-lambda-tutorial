
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");

const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} = require("@aws-sdk/lib-dynamodb");

const dynamoDB = DynamoDBDocumentClient.from(
  new DynamoDBClient({})
);

const CART_TABLE = process.env.CART_TABLE;
const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE;

const response = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE",
  },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  try {
    // REST API Cognito User Pool authorizer claims.
    const userId =
      event.requestContext?.authorizer?.claims?.sub;

    if (!userId) {
      return response(401, {
        message: "Unauthorized",
      });
    }

    const method = event.httpMethod;
    const productId = event.pathParameters?.productId;

    // GET /cart
    if (method === "GET" && !productId) {
      const result = await dynamoDB.send(
        new QueryCommand({
          TableName: CART_TABLE,
          KeyConditionExpression: "userId = :userId",
          ExpressionAttributeValues: {
            ":userId": userId,
          },
        })
      );

      return response(200, {
        items: result.Items || [],
      });
    }

    // POST /cart/items
    if (method === "POST" && !productId) {
      const body = JSON.parse(event.body || "{}");
      const { productId: requestedProductId, quantity } = body;

      if (
        !requestedProductId ||
        !Number.isInteger(quantity) ||
        quantity <= 0
      ) {
        return response(400, {
          message: "productId and positive integer quantity are required",
        });
      }

      const productResult = await dynamoDB.send(
        new GetCommand({
          TableName: PRODUCTS_TABLE,
          Key: { id: requestedProductId },
        })
      );

      const product = productResult.Item;

      if (!product) {
        return response(404, {
          message: "Product not found",
        });
      }

      await dynamoDB.send(
        new PutCommand({
          TableName: CART_TABLE,
          Item: {
            userId,
            productId: requestedProductId,
            quantity,
            productName: product.name,
            unitPrice: product.price,
            updatedAt: new Date().toISOString(),
          },
        })
      );

      return response(201, {
        message: "Item added to cart",
        productId: requestedProductId,
        quantity,
      });
    }

    // PUT /cart/items/{productId}
    if (method === "PUT" && productId) {
      const body = JSON.parse(event.body || "{}");
      const { quantity } = body;

      if (!Number.isInteger(quantity) || quantity <= 0) {
        return response(400, {
          message: "Quantity must be a positive integer",
        });
      }

      const result = await dynamoDB.send(
        new UpdateCommand({
          TableName: CART_TABLE,
          Key: { userId, productId },
          UpdateExpression:
            "SET quantity = :quantity, updatedAt = :updatedAt",
          ExpressionAttributeValues: {
            ":quantity": quantity,
            ":updatedAt": new Date().toISOString(),
          },
          ConditionExpression: "attribute_exists(productId)",
          ReturnValues: "ALL_NEW",
        })
      );

      return response(200, {
        message: "Cart item updated",
        item: result.Attributes,
      });
    }

    // DELETE /cart/items/{productId}
    if (method === "DELETE" && productId) {
      await dynamoDB.send(
        new DeleteCommand({
          TableName: CART_TABLE,
          Key: { userId, productId },
          ConditionExpression: "attribute_exists(productId)",
        })
      );

      return response(200, {
        message: "Cart item deleted",
        productId,
      });
    }

    if (method === "OPTIONS") {
      return response(200, {});
    }

    return response(404, {
      message: "Route not found",
    });
  } catch (error) {
    console.error("Cart API error:", error);

    if (error.name === "ConditionalCheckFailedException") {
      return response(404, {
        message: "Cart item not found",
      });
    }

    if (error instanceof SyntaxError) {
      return response(400, {
        message: "Invalid JSON request body",
      });
    }

    return response(500, {
      message: "Internal server error",
    });
  }
};
