# AWS SQS, SNS & Lambda – Order Processing

## 1. Prerequisites

- Node.js installed
- PostgreSQL installed and running
- AWS CLI configured
- AWS SQS queue created
- AWS SNS topic created
- AWS Lambda function created and configured with an execution role
- SQS Event Source Mapping configured for Lambda

## 2. Project Setup

Install the project dependencies from the root directory:

```bash
npm install
```

Create a `.env` file in the project root:

```env
PORT=3000

DATABASE_URL=postgresql://username:password@localhost:5432/interview_prep

SQS_QUEUE_URL=your_sqs_queue_url
SNS_TOPIC_ARN=your_sns_topic_arn
```

Update the values according to your AWS and PostgreSQL configuration.

## 3. Start the Orders API

Run the following command from the project root:

```bash
npm run orders-api
```

This starts the Express server using `server.js`.

Expected output:

```text
Database connection successful
Orders API listening on port 3000
```

## 4. Create an Order

Use Postman or any API client to make the following request.

**Endpoint:**

```http
POST http://localhost:3000/orders
```

**Request Body:**

```json
{
  "customerName": "Sunil",
  "amount": 2500,
  "status": "CREATED"
}
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "orderId": "1",
    "customerName": "Sunil",
    "amount": 2500,
    "status": "CREATED"
  }
}
```

The API performs the following operations:

1. Validates the request.
2. Inserts the order into PostgreSQL.
3. Publishes the order message to SQS.
4. Returns the created order details.

## 5. Verify Background Processing

After creating an order, verify the following:

1. **SQS:** Check that the message is received from `orders-queue`.
2. **Lambda:** Check the execution logs in CloudWatch.
3. **PostgreSQL:** Verify the order processing status.
4. **SNS:** Verify that the completion notification is published.
5. **Email:** Check your subscribed email inbox.

## 6. Deploy Lambda

Lambda deployment is currently performed manually through the AWS Console.

### Step 1: Navigate to Lambda directory

From the project root:

```bash
cd lambda/order-consumer
```

### Step 2: Generate deployment ZIP

Run:

```bash
npm run build
```

This executes the `Compress-Archive` command and generates:

```text
function.zip
```

The ZIP contains:

- `index.js`
- `package.json`
- `package-lock.json`
- `node_modules/`

### Step 3: Upload ZIP to AWS Lambda

1. Open AWS Management Console.
2. Navigate to AWS Lambda.
3. Select the `order-consumer` function.
4. Open the **Code** tab.
5. Select **Upload from → .zip file**.
6. Select the generated `function.zip`.
7. Click **Deploy**.

### Step 4: Verify Lambda Configuration

Ensure the following settings are configured:

| Configuration | Value |
|---|---|
| Runtime | Node.js |
| Handler | `index.handler` |
| Execution Role | Lambda execution role |
| Environment Variable | `SNS_TOPIC_ARN` |
| Trigger | `orders-queue` SQS |
| Batch Failure Reporting | Enabled |

AWS Lambda automatically provides the AWS region and temporary credentials through its execution role.

### Step 5: Verify Deployment

After uploading the ZIP:

1. Check the Lambda function's Code tab.
2. Verify that the latest code is deployed.
3. Check CloudWatch logs after sending a test order.
4. Verify successful message processing.

---

## 7. Useful Commands

| Command | Purpose |
|---|---|
| `npm install` | Install root dependencies |
| `npm run orders-api` | Start Express Orders API |
| `cd lambda/order-consumer` | Navigate to Lambda directory |
| `npm install` | Install Lambda dependencies |
| `npm run build` | Generate Lambda deployment ZIP |

**Note:** Run `npm run build` from inside `lambda/order-consumer`, then upload the generated ZIP through the AWS Lambda Console.