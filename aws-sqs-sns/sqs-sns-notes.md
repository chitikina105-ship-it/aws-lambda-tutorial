# AWS SQS, SNS & Lambda – Interview Preparation Notes

**Level:** 5+ Years Full Stack Developer  
**Technologies:** Node.js, AWS SQS, SNS, Lambda, CloudWatch

---

# 1. AWS Messaging – Introduction

In distributed systems and microservices architectures, services often need to communicate asynchronously.

For example, when a customer places an order:

1. Order API receives the request.
2. Order information is stored.
3. A message is published to SQS.
4. A background worker processes the order.
5. SNS publishes a notification after successful processing.
6. Customer receives an email notification.

AWS provides three important services for this architecture:

| Service | Responsibility |
|---|---|
| SQS | Message queuing and asynchronous processing |
| SNS | Message publishing and notifications |
| Lambda | Serverless execution and message processing |

## Why do we need messaging services?

Imagine an application receives 1,000 order requests simultaneously.

Without asynchronous processing:

- API requests may take longer.
- Backend services may become overloaded.
- Failures in downstream services may affect API availability.

With SQS:

- API publishes messages to a queue.
- API can respond without waiting for background processing.
- Consumers process messages independently.
- Multiple consumers can process messages concurrently.
- Failed messages can be retried.

---

# 2. Amazon SQS (Simple Queue Service)

## 2.1 What is SQS?

Amazon SQS is a fully managed message queuing service that allows applications to communicate asynchronously.

It acts as a temporary storage location for messages until consumers retrieve and process them.

### Example

An order API publishes this message:

- Order ID: ORD101
- Customer: Sunil
- Amount: 2500
- Status: CREATED

SQS stores this message until a consumer retrieves it.

## 2.2 SQS Architecture

Order API → SQS Queue → Consumer → Business Processing

The producer and consumer don't need to execute at the same time.

The producer publishes messages, and consumers process them whenever they are available.

## 2.3 SQS Queue Types

SQS provides two queue types.

| Feature | Standard Queue | FIFO Queue |
|---|---|---|
| Ordering | Best-effort ordering | Preserves ordering within a message group |
| Delivery | At-least-once | Exactly-once processing deduplication within the deduplication interval |
| Throughput | High, nearly unlimited | Depends on FIFO throughput configuration |
| Deduplication | Application-level handling | Built-in deduplication support |
| Use case | General background processing | Ordered business workflows |

1. Supports deduplication using a MessageDeduplicationId. (Means If Two messages with same MessageId came then it remove the duplicate)
2. If the same deduplication ID is sent again within the 5-minute deduplication interval, SQS suppresses the duplicate.

### Standard Queue Example

An application receives multiple orders:

ORD101, ORD102, ORD103.

Messages can be delivered out of order, and duplicate deliveries are possible.

### FIFO Queue Example

Consider bank transactions.

If transactions must be processed in sequence, FIFO queues can help preserve their order within a message group.

**Interview point:** FIFO queues provide ordering and deduplication features, but consumers should still implement idempotent processing.

---

# 3. Important SQS Concepts

## 3.1 Producer

A producer is an application that sends messages to an SQS queue.

Example:

An Order API publishes an order message after a customer places an order.

## 3.2 Consumer

A consumer retrieves messages from SQS and processes them.

Examples:

- Node.js background worker
- AWS Lambda
- Container-based microservice

## 3.3 SendMessage

Publishes a message to an SQS queue.

Example:

Order API sends ORD101 to `orders-queue`.

## 3.4 ReceiveMessage

Retrieves messages from an SQS queue.

Important: Receiving a message does not automatically delete it.

SQS temporarily hides the message from other consumers using Visibility Timeout.

## 3.5 DeleteMessage

Deletes a successfully processed message.

The consumer uses the ReceiptHandle received during the latest receive operation.

### MessageId vs ReceiptHandle

| MessageId | ReceiptHandle |
|---|---|
| Identifies the original message | Identifies a particular receive operation |
| Remains the same across redeliveries | Changes with each receive |
| Useful for message identification | Required for deleting a received message |

---

# 4. Visibility Timeout

## What is Visibility Timeout?

Visibility Timeout is the period during which a received message remains invisible to other consumers.

It prevents multiple consumers from processing the same message simultaneously under normal conditions.

### Example

Suppose Visibility Timeout is 30 seconds.

1. Consumer receives ORD101.
2. SQS marks the message as in-flight.
3. Consumer starts processing.
4. Consumer fails without deleting the message.
5. After 30 seconds, the message becomes available again.
6. Another consumer can receive it.

### Message states

| State | Meaning |
|---|---|
| Available | Waiting to be consumed |
| In-flight | Received but not deleted |
| Deleted | Successfully removed from the queue |

### Important interview points

- Visibility Timeout does not delete messages.
- If processing takes longer than the timeout, another consumer may receive the message.
- Visibility Timeout can be extended using ChangeMessageVisibility.
- Visibility Timeout should be configured based on expected processing duration.

**Lambda consideration:** AWS recommends configuring the SQS visibility timeout to at least six times the Lambda function timeout, plus the maximum batching window.

---

# 5. Short Polling vs Long Polling

## Short Polling

SQS responds immediately when a consumer requests messages, even if no messages are available.

This can produce unnecessary empty responses.

## Long Polling

SQS waits for messages to arrive before responding, up to the configured wait time.

Maximum WaitTimeSeconds: 20 seconds.

### Example

Without long polling:
- Consumer requests messages.
- SQS returns no messages.
- Consumer requests again.
- More unnecessary requests are made.

With long polling:
- Consumer requests messages.
- SQS waits for up to 20 seconds.
- Returns messages when available or when the wait period expires.

**Interview point:** Long polling reduces empty responses and unnecessary API calls.

---

# 6. Message Retention Period

Message retention defines how long messages remain in a queue if they aren't deleted.

For SQS:

- Minimum: 1 minute.
- Maximum: 14 days.
- Default: 4 days.

Example:

If a message remains unprocessed beyond its retention period, SQS automatically removes it.

Message retention and Visibility Timeout are different:

- Retention: How long the message remains in the queue.
- Visibility Timeout: How long a received message remains hidden.

---

# 7. Dead Letter Queue (DLQ)

## What is DLQ?

A Dead Letter Queue is a separate queue where messages are moved after exceeding the configured maximum receive count.

It helps isolate messages that repeatedly fail processing.

### Example

Suppose ORD101 repeatedly fails because a payment service is unavailable.

Processing attempts:

1. First attempt – Failed.
2. Second attempt – Failed.
3. Third attempt – Failed.
4. Message exceeds configured receive threshold and is moved to DLQ.

### Architecture

orders-queue → Consumer → Processing Failure → Retry → DLQ

## Redrive Policy

A redrive policy configures:

- Dead Letter Queue destination.
- Maximum receive count.

Example:

Maximum receives = 3.

After repeated unsuccessful receives, the message is moved to the configured DLQ.

Note: The maximum receive count is a threshold, not a guarantee of an exact number of application-level executions. Receive attempts and batch failures affect how it behaves.

## DLQ Redrive

Once the root cause is identified and fixed, messages can be moved from DLQ back to the original queue.

AWS provides a managed feature called Start DLQ redrive.

Important:

- Redrive moves messages from DLQ to the destination queue.
- After successful redrive, they no longer remain in the DLQ.
- The consumer processes them again from the original queue.
- If processing fails repeatedly again, they can return to DLQ.

### Production use case

If a deployment introduces a bug:

1. Messages repeatedly fail.
2. They move to DLQ.
3. Developers investigate CloudWatch logs.
4. Developers fix the bug and deploy.
5. Operations team starts DLQ redrive.
6. Messages are processed again.

---

# 8. SQS Delivery Semantics

## At-least-once Delivery

Standard SQS queues provide at-least-once delivery.

This means a message can be delivered more than once.

Even if your application processes a message successfully, duplicate delivery can happen.

Therefore, consumers must implement idempotent processing.

## Exactly-once Processing

FIFO queues support deduplication within a configured deduplication interval.

However, this does not guarantee exactly-once execution of arbitrary external business operations.

Consumers should still be idempotent.

---

# 9. Idempotency

## What is Idempotency?

Idempotency means executing the same operation multiple times produces the same final business result as executing it once.

### Example: Duplicate SQS Message

1. Consumer receives ORD101.
2. Consumer updates the database to COMPLETED.
3. Consumer crashes before deleting the SQS message.
4. Visibility Timeout expires.
5. SQS delivers ORD101 again.

Without idempotency, the consumer might process the same order twice.

### Solution

Maintain processing status in the database.

Example:

| Order ID | Status |
|---|---|
| ORD101 | COMPLETED |
| ORD102 | PENDING |

When ORD101 is received again:

- Consumer checks its processing status.
- If already completed, skip the business operation.
- Acknowledge/delete the message successfully.

In production, use atomic database transactions, unique constraints or conditional updates to handle concurrent processing safely.

## API-Level Idempotency

Another problem occurs when customers submit the same order request multiple times.

For example, a user double-clicks Place Order.

Use an Idempotency Key.

Example:

- Request 1 → Key: KEY123.
- Request 2 → Key: KEY123.

The backend stores this key with a unique constraint.

If the same key is received again, return the existing order instead of creating another one.

### Two different problems

| Problem | Solution |
|---|---|
| Duplicate API requests | Idempotency Key |
| Duplicate SQS delivery | Consumer-level idempotency |

---

# 10. Amazon SNS (Simple Notification Service)

## What is SNS?

Amazon SNS is a fully managed pub/sub messaging service.

It allows publishers to send messages to a topic, which delivers them to multiple subscribers.

### Main components

| Component | Responsibility |
|---|---|
| Publisher | Publishes messages |
| Topic | Logical communication channel |
| Subscriber | Receives messages |
| Subscription | Connects subscriber to a topic |

## SNS Architecture

Publisher → SNS Topic → Multiple Subscribers

### Example

When an order is completed, the application publishes a notification.

SNS delivers the message to:

- Email subscription.
- SQS queue for analytics.
- Another SQS queue for invoice processing.
- Lambda subscriber.

One publication can reach multiple subscribers.

This is called Fan-out.

---

# 11. SNS Topic Types

SNS supports:

- Standard topics.
- FIFO topics.

| Feature | Standard | FIFO |
|---|---|---|
| Ordering | Best effort | Preserved within message groups |
| Deduplication | No built-in FIFO deduplication | Supports deduplication |
| Throughput | High | Configurable FIFO throughput |
| Use case | Notifications and general pub/sub | Ordered, deduplicated event distribution |

---

# 12. SNS Subscriptions

A subscription connects an endpoint to an SNS topic.

Supported subscriber protocols include:

- Email
- Email-JSON
- HTTP/HTTPS
- AWS SQS
- AWS Lambda
- SMS
- Firehose

### Example

Topic: `order-notifications`

Subscriptions:

| Subscriber | Purpose |
|---|---|
| Email | Send customer notification |
| SQS | Process invoice generation |
| Lambda | Update another system |

When a message is published, SNS distributes it to subscribed endpoints.

## Email Subscription

SNS can send basic email notifications directly.

Example:

Subject: Order Confirmation – ORD101

Message:

Your order ORD101 has been successfully placed.

Amount: INR 2500.

Important limitations:

- SNS email subscription supports basic notifications.
- It does not provide fully customized HTML email templates.
- Email subscription must be confirmed before delivery.

---

# 13. SNS vs SQS

This is a very important interview question.

| Feature | SQS | SNS |
|---|---|---|
| Messaging model | Queue-based | Pub/Sub |
| Main purpose | Store messages until consumed | Distribute messages to subscribers |
| Consumer | Pull-based | Push-based delivery |
| Message storage | Stores messages until deleted or expired | Delivers to subscribed endpoints; not a durable queue for subscribers |
| Multiple consumers | Competing consumers | Multiple independent subscribers |
| Retry | Visibility timeout and redrive policy | Delivery retries depend on subscriber protocol |
| DLQ | Supported | Supported for applicable subscription delivery failures |

### Simple explanation

SQS is used when messages need to be stored and processed asynchronously.

SNS is used when a message needs to be distributed to multiple subscribers.

---

# 14. SNS Fan-out Pattern

Fan-out means publishing one message to SNS and delivering it to multiple subscribers.

### Example

An order is completed.

SNS topic: `order-notifications`

Subscribers:

1. Email subscription – Customer notification.
2. SQS queue – Invoice generation.
3. SQS queue – Analytics processing.
4. Lambda – Update reporting system.

### Architecture

Order Service → SNS Topic → Multiple Subscribers

### Why use SNS + SQS together?

SNS provides message distribution.

SQS provides independent buffering and processing for each subscriber.

Benefits:

- Services are loosely coupled.
- Subscribers process messages independently.
- Temporary failures in one subscriber don't block other subscribers.
- Each SQS queue can have its own consumer and DLQ.

This pattern is called SNS-to-SQS Fan-out.

---

# 15. SNS Message Filtering

SNS supports subscription filter policies.

They allow subscribers to receive only messages matching specified attributes.

### Example

Suppose SNS publishes:

- Order status: COMPLETED.
- Order status: CANCELLED.
- Order status: FAILED.

We can configure subscriptions:

| Subscriber | Filter |
|---|---|
| Email notification | COMPLETED |
| Refund processing | CANCELLED |
| Error monitoring | FAILED |

This avoids sending irrelevant messages to subscribers.

---

# 16. SNS vs SES

Another common interview topic.

| Feature | SNS | SES |
|---|---|---|
| Primary purpose | Pub/Sub notifications | Email delivery service |
| Basic email | Yes | Yes |
| Custom HTML templates | No, not through basic email subscriptions | Yes |
| Custom sender identity | Limited | Yes |
| Transactional email | Basic notifications | Designed for detailed email workflows |
| Use case | Notifications and event distribution | Branded emails, invoices, OTPs and transactional emails |

### Example

SNS:

"Your order has been successfully placed."

SES:

A customized HTML order confirmation containing:
- Company logo.
- Order details.
- Product information.
- Invoice link.
- Branding and formatting.

---

# 17. AWS Lambda

## What is AWS Lambda?

AWS Lambda is a serverless compute service that executes application code in response to events.

Developers don't need to provision or manage servers.

Lambda automatically manages the execution infrastructure.

### Important concepts

| Concept | Description |
|---|---|
| Handler | Entry point of Lambda function |
| Trigger | Event that causes Lambda invocation |
| Execution role | IAM role used by Lambda |
| Timeout | Maximum execution duration |
| Memory | Memory allocated to function |
| Concurrency | Number of simultaneous executions |
| CloudWatch | Logs and monitoring |
| Event Source Mapping | Polls supported event sources and invokes Lambda |

## Lambda Execution Flow

1. An event occurs.
2. Lambda receives the event.
3. Lambda executes the handler.
4. Function returns a response or reports failure.
5. Lambda manages execution according to the trigger integration.

---

# 18. SQS + Lambda Integration

This is one of the most important AWS architecture patterns.

### Does SQS directly trigger Lambda?

Not exactly.

Lambda uses an Event Source Mapping to poll SQS.

The Event Source Mapping:

1. Polls SQS.
2. Retrieves messages.
3. Invokes Lambda with a batch of messages.
4. Handles message acknowledgement based on the Lambda invocation result.

### Architecture

Order API → SQS → Lambda Event Source Mapping → Lambda Consumer

### Example

A customer places an order.

1. Order API publishes ORD101 to SQS.
2. Lambda Event Source Mapping polls the queue.
3. Lambda receives the message batch.
4. Lambda processes the order.
5. On successful processing, the event source mapping deletes the successfully processed messages.
6. On failure, messages become available again after visibility timeout.

Note: Lambda's Event Source Mapping (ESM) is an AWS-managed integration that connects an event source, such as SQS, to a Lambda function. Bridge between SQS and Lambda

Important: Lambda does not require application code to call DeleteMessage for a successfully processed SQS event.


---

# 19. Lambda Batch Processing

Lambda can retrieve multiple SQS messages in one invocation.

Example:

Batch size = 10.

Lambda receives:

- ORD101
- ORD102
- ORD103
- ORD104
- ...

This reduces invocation overhead and can improve throughput.

### What if one message fails?

By default, if the Lambda invocation fails, the entire batch can become eligible for retry.

This may cause successfully processed messages to be processed again.

### Partial Batch Response

AWS supports `ReportBatchItemFailures`.

It allows Lambda to report only the failed messages.

Example:

| Message | Result |
|---|---|
| ORD101 | Success |
| ORD102 | Success |
| ORD103 | Failed |
| ORD104 | Success |

With partial batch failure reporting:

- ORD101 is acknowledged.
- ORD102 is acknowledged.
- ORD103 is retried.
- ORD104 is acknowledged.

This avoids retrying the entire batch unnecessarily.

---

# 20. Lambda Concurrency

Concurrency represents the number of Lambda invocations executing simultaneously.

Example:

SQS has 1,000 messages.

Lambda can process messages through multiple concurrent invocations, subject to event source mapping limits, account concurrency and configured scaling.

Benefits:

- Parallel processing.
- Better throughput.
- Automatic scaling.

Important considerations:

- Database connection limits.
- Downstream API rate limits.
- Lambda concurrency quotas.
- SQS polling and scaling configuration.

---

# 21. Lambda + SQS + SNS Architecture

This is the architecture implemented during our practical learning.

### Production architecture

1. Node.js Order API publishes an order to SQS.
2. SQS stores the message.
3. Lambda Event Source Mapping polls SQS.
4. Lambda receives the order message.
5. Lambda processes the order.
6. After successful processing, Lambda publishes a notification to SNS.
7. SNS distributes the message to subscribers.
8. Customer receives an email.
9. Lambda invocation succeeds and the event source mapping acknowledges the SQS message.

### Architecture diagram

Node.js Order API → SQS → Lambda → SNS Topic → Email Subscription

Failure path:

Lambda Processing Failure → Retry → Visibility Timeout → Retry Again → DLQ

### Important production considerations

- Use idempotency to avoid duplicate order processing.
- Use partial batch failure responses.
- Configure DLQ and redrive policy.
- Monitor failures through CloudWatch.
- Ensure appropriate IAM permissions.
- Avoid publishing duplicate notifications.

---

# 22. What happens if SNS succeeds but SQS acknowledgement fails?

This is an important distributed-systems scenario.

Example:

1. Lambda receives ORD101.
2. Lambda processes the order successfully.
3. Lambda publishes notification to SNS.
4. SNS successfully delivers the email.
5. Lambda crashes before its invocation is successfully acknowledged.
6. SQS message is delivered again.
7. Lambda processes the same order again.
8. SNS may publish another email.

The customer might receive duplicate emails.

### Solution

Implement notification idempotency.

For example, maintain a notification record:

| Order ID | Notification Type | Status |
|---|---|---|
| ORD101 | ORDER_COMPLETED | SENT |

Before publishing, check whether the notification has already been sent.

For robust production systems, use a transactional outbox or another durable notification workflow so that business state and notification intent are coordinated.

---

# 23. CloudWatch Monitoring

Amazon CloudWatch helps monitor Lambda execution and SQS queues.

## Lambda Logs

CloudWatch stores Lambda execution logs.

Useful information:

- Execution started.
- Processing completed.
- Exceptions.
- Stack traces.
- Duration.
- Request ID.

## Important SQS Metrics

| Metric | Meaning |
|---|---|
| ApproximateNumberOfMessagesVisible | Available messages |
| ApproximateNumberOfMessagesNotVisible | In-flight messages |
| ApproximateNumberOfMessagesDelayed | Delayed messages |
| ApproximateAgeOfOldestMessage | Age of the oldest available message |

## Important Lambda Metrics

| Metric | Meaning |
|---|---|
| Invocations | Number of function executions |
| Errors | Number of failed executions |
| Duration | Execution duration |
| ConcurrentExecutions | Concurrent invocations |
| Throttles | Requests rejected due to concurrency limits |

### Production monitoring

Create CloudWatch alarms for:

- DLQ message count greater than zero.
- High number of Lambda errors.
- Increasing queue backlog.
- High age of oldest message.
- Lambda throttling.

# 24. Key Interview Takeaways

For a 5+ years Full Stack Developer, focus especially on:

1. SQS Standard vs FIFO.
2. Visibility Timeout and message redelivery.
3. DLQ, retry and redrive policies.
4. At-least-once delivery and idempotency.
5. SNS Pub/Sub and Fan-out.
6. SNS vs SQS vs SES.
7. SQS-Lambda integration and Event Source Mapping.
8. Lambda batch processing and partial batch failure.
9. Lambda concurrency and scaling.
10. CloudWatch monitoring and IAM security.