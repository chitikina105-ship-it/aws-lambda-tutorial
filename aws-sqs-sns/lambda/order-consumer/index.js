import {
  SNSClient,
  PublishCommand
} from "@aws-sdk/client-sns";

const sns = new SNSClient({
  region: process.env.AWS_REGION
});

// Simulate order processing for now.
// Later, we'll replace this with PostgreSQL operations.
async function processOrder(order) {
  console.log("Processing order:", order.orderId);

  // Simulate processing failure for testing
  if (order.status === "FAILED") {
    throw new Error("Simulated order processing failure");
  }

  console.log("Order processed successfully:", order.orderId);
}

export const handler = async (event) => {
  const batchItemFailures = [];

  for (const record of event.Records ?? []) {
    try {
      // SQS message body
      const order = JSON.parse(record.body);

      // Process the order
      await processOrder(order);

      // Publish notification only after successful processing
      await sns.send(
        new PublishCommand({
          TopicArn: process.env.SNS_TOPIC_ARN,
          Subject: `Order ${order.orderId} completed`,
          Message: JSON.stringify({
            event: "ORDER_COMPLETED",
            orderId: order.orderId,
            customerName: order.customerName,
            amount: order.amount,
            status: "COMPLETED"
          })
        })
      );

      console.log("SNS notification published:", order.orderId);
      
      // Update the order status to COMPLETED in postgreSQL
      // Lambda may connect to PostgreSQL via RDS Proxy or directly to the database, depending on your architecture.

    } catch (error) {
      console.error("Failed to process message:", record.messageId, error);

      batchItemFailures.push({
        itemIdentifier: record.messageId
      });
    }
  }

  return {
    batchItemFailures
  };
};