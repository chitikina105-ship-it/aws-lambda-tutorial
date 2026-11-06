const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");
const { randomUUID } = require("node:crypto");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  QueryCommand,
  GetCommand,
  PutCommand,
} = require("@aws-sdk/lib-dynamodb");

const sns = new SNSClient({});
const ORDER_EVENTS_TOPIC_ARN = process.env.ORDER_EVENTS_TOPIC_ARN;

const dynamoDB = DynamoDBDocumentClient.from(
  new DynamoDBClient({})
);

const CART_TABLE = process.env.CART_TABLE;
const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE;
const ORDERS_TABLE = process.env.ORDERS_TABLE;

const response = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "OPTIONS,POST",
  },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  // Handle CORS preflight before checking authentication claims.
  if (event.httpMethod === "OPTIONS") {
    return response(200, {});
  }

  try {
    // Identity comes from API Gateway's Cognito authorizer.
    const userId =
      event.requestContext?.authorizer?.claims?.sub;

    if (!userId) {
      return response(401, {
        message: "Unauthorized",
      });
    }

    if (event.httpMethod !== "POST") {
      return response(405, {
        message: "Method not allowed",
      });
    }

    // 1. Read this authenticated user's cart.
    const cartResult = await dynamoDB.send(
      new QueryCommand({
        TableName: CART_TABLE,
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: {
          ":userId": userId,
        },
      })
    );

    const cartItems = cartResult.Items || [];

    if (cartItems.length === 0) {
      return response(400, {
        message: "Your cart is empty",
      });
    }

    // 2. Fetch current product data and calculate total.
    const orderItems = [];
    let totalAmount = 0;

    for (const cartItem of cartItems) {
      if (
        !cartItem.productId ||
        !Number.isInteger(cartItem.quantity) ||
        cartItem.quantity <= 0
      ) {
        return response(400, {
          message: "Cart contains an invalid item",
        });
      }

      const productResult = await dynamoDB.send(
        new GetCommand({
          TableName: PRODUCTS_TABLE,
          Key: { id: cartItem.productId },
        })
      );

      const product = productResult.Item;

      if (
        !product ||
        typeof product.price !== "number" ||
        !Number.isFinite(product.price) ||
        product.price < 0
      ) {
        return response(400, {
          message: `Product ${cartItem.productId} is unavailable or has an invalid price`,
        });
      }

      const lineTotal = product.price * cartItem.quantity;
      totalAmount += lineTotal;

      orderItems.push({
        productId: product.id,
        productName: product.name,
        quantity: cartItem.quantity,
        unitPrice: product.price,
        lineTotal,
      });
    }

    // 3. Create the order.
    const orderId = randomUUID();
    const createdAt = new Date().toISOString();

    const order = {
      orderId,
      userId,
      status: "PENDING",
      items: orderItems,
      totalAmount: Number(totalAmount.toFixed(2)),
      createdAt,
    };

    // 4. Save it in DynamoDB.
    await dynamoDB.send(
      new PutCommand({
        TableName: ORDERS_TABLE,
        Item: order,
        ConditionExpression: "attribute_not_exists(orderId)",
      })
    );

    
    await sns.send(
      new PublishCommand({
        TopicArn: ORDER_EVENTS_TOPIC_ARN,
        Message: JSON.stringify({
          eventType: "ORDER_PLACED",
          orderId: order.orderId,
          userId: order.userId,
          totalAmount: order.totalAmount,
          createdAt: order.createdAt,
        }),
        MessageAttributes: {
          eventType: {
            DataType: "String",
            StringValue: "ORDER_PLACED",
          },
        },
      })
    );


    // Keep the cart intact for now.
    return response(201, {
      message: "Order created successfully",
      order,
    });
  } catch (error) {
    console.error("Orders API error:", error);

    return response(500, {
      message: "Failed to create order",
    });
  }
};
