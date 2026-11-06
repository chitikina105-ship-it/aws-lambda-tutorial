
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand
} from "@aws-sdk/client-sqs";

import {
  SNSClient,
  PublishCommand
} from "@aws-sdk/client-sns";

import dotenv from "dotenv";

dotenv.config();

const sqsClient = new SQSClient({
  region: process.env.AWS_REGION
});

const snsClient = new SNSClient({
  region: process.env.AWS_REGION
});

const processOrder = async (order) => {
  console.log(`Processing order ${order.orderId}...`);

  // Simulate business processing
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log("Order processing completed!");

  // Publish notification only after successful processing
  const message = `
      Hello ${order.customerName},

      Your order has been successfully processed!

      Order ID: ${order.orderId}
      Amount: INR ${order.amount}
      Status: COMPLETED

      Thank you!
  `;

  const snsCommand = new PublishCommand({
    TopicArn: process.env.SNS_TOPIC_ARN,
    Subject: `Order Completed - ${order.orderId}`,
    Message: message
  });

  await snsClient.send(snsCommand);

  console.log("SNS notification published!");
};

const receiveOrder = async () => {
  try {
    const command = new ReceiveMessageCommand({
      QueueUrl: process.env.SQS_QUEUE_URL,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 20
    });

    const response = await sqsClient.send(command);

    if (!response.Messages?.length) {
      console.log("No messages available");
      return;
    }

    for (const message of response.Messages) {
      try {
        const order = JSON.parse(message.Body);

        await processOrder(order);

        // Delete SQS message only after successful processing
        const deleteCommand = new DeleteMessageCommand({
          QueueUrl: process.env.SQS_QUEUE_URL,
          ReceiptHandle: message.ReceiptHandle
        });

        await sqsClient.send(deleteCommand);

        console.log("SQS message deleted successfully!");

      } catch (error) {
        console.error("Order processing failed:", error.message);

        // Don't delete the message.
        // SQS will make it available again after visibility timeout.
      }
    }

  } catch (error) {
    console.error("Consumer error:", error);
  }
};

receiveOrder();
