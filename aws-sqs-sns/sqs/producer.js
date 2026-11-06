import {
  SQSClient,
  SendMessageCommand
} from "@aws-sdk/client-sqs";

import dotenv from "dotenv";

dotenv.config();

const sqsClient = new SQSClient({
  region: process.env.AWS_REGION
});

const sendOrder = async () => {
  try {
    const order = {
      orderId: "ORD101",
      customerName: "Sunil",
      amount: 2500,
      status: "CREATED"
    };

    const command = new SendMessageCommand({
      QueueUrl: process.env.SQS_QUEUE_URL,
      MessageBody: JSON.stringify(order)
    });

    const response = await sqsClient.send(command);

    console.log("Message sent successfully!");
    console.log("Message ID:", response.MessageId);

  } catch (error) {
    console.error("Error sending message:", error);
  }
};

sendOrder();