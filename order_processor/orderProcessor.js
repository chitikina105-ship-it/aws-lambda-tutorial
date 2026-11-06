
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");

const {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");

const dynamoDB = DynamoDBDocumentClient.from(
  new DynamoDBClient({})
);

const ORDERS_TABLE = process.env.ORDERS_TABLE;

exports.handler = async (event) => {
  // Lambda receives SQS messages in event.Records.
  for (const record of event.Records || []) {
    // SNS -> SQS normally wraps the published message
    // inside an SNS notification envelope.
    const sqsBody = JSON.parse(record.body);

    const message = sqsBody.Message
      ? JSON.parse(sqsBody.Message)
      : sqsBody;

    if (message.eventType !== "ORDER_PLACED") {
      console.log("Ignoring unsupported event:", message.eventType);
      continue;
    }

    const { orderId } = message;

    if (!orderId) {
      throw new Error("Missing orderId in event");
    }

    console.log("Processing order:", orderId);

    // 1. Retrieve the order.
    const result = await dynamoDB.send(
      new GetCommand({
        TableName: ORDERS_TABLE,
        Key: { orderId },
      })
    );

    const order = result.Item;

    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    // 2. Make processing safe for duplicate messages.
    if (order.status === "CONFIRMED") {
      console.log("Order already confirmed:", orderId);
      continue;
    }

    if (order.status !== "PENDING") {
      throw new Error(
        `Cannot process order ${orderId} with status ${order.status}`
      );
    }

    // 3. Simulate successful order processing.
    // Later, inventory/payment checks can go here.
    const processedAt = new Date().toISOString();

    try {
      await dynamoDB.send(
        new UpdateCommand({
          TableName: ORDERS_TABLE,
          Key: { orderId },
          UpdateExpression:
            "SET #status = :confirmed, processedAt = :processedAt",
          ConditionExpression: "#status = :pending",
          ExpressionAttributeNames: {
            "#status": "status",
          },
          ExpressionAttributeValues: {
            ":pending": "PENDING",
            ":confirmed": "CONFIRMED",
            ":processedAt": processedAt,
          },
        })
      );
    } catch (error) {
      if (error.name === "ConditionalCheckFailedException") {
        // Another invocation may have processed this order.
        const latest = await dynamoDB.send(
          new GetCommand({
            TableName: ORDERS_TABLE,
            Key: { orderId },
          })
        );

        if (latest.Item?.status === "CONFIRMED") {
          console.log("Order confirmed by another invocation:", orderId);
          continue;
        }
      }

      throw error;
    }

    console.log("Order confirmed:", orderId);
  }

  // Returning successfully allows Lambda to acknowledge
  // the SQS batch. Failed invocations can be retried.
  return { batchItemFailures: [] };
};
