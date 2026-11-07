import {
  SQSClient,
  SendMessageCommand
} from "@aws-sdk/client-sqs";

const sqsClient = new SQSClient({
  region: process.env.AWS_REGION
});

export const sendOrder = async (order) => {
  try {
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

