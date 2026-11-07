import pool from "../db/pool.js";
import AppError from "../errors/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendOrder } from "../utils/sqs-utils.js";

export const createOrder = asyncHandler(async (req, res) => {
  const { customerName, amount, status } = req.body ?? {};

  if (
    typeof customerName !== "string" ||
    !customerName.trim() ||
    typeof amount !== "number" ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    typeof status !== "string" ||
    !status.trim()
  ) {
    throw new AppError("Invalid order details", 400);
  }

  const result = await pool.query(
    `INSERT INTO public.orders
      (customer_name, amount, status)
     VALUES ($1, $2, $3)
     RETURNING order_id AS "orderId",
               customer_name AS "customerName",
               amount,
               status`,
    [customerName.trim(), amount, status.trim()]
  );

  const order = result.rows[0];

  await sendOrder(order);

  res.status(201).json({
    success: true,
    data: {
      ...order,
      amount: Number(order.amount)
    }
  });
});