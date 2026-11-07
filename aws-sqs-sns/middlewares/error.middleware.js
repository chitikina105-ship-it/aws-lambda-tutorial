import AppError from "../errors/AppError.js";

const errorMiddleware = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";

  // PostgreSQL unique constraint violation
  if (err.code === "23505") {
    statusCode = 409;
    message = "An order with this orderId already exists";
  }

  // Invalid JSON request body
  if (err.type === "entity.parse.failed") {
    statusCode = 400;
    message = "Request body must be valid JSON";
  }

  // Log unexpected errors
  if (!(err instanceof AppError)) {
    console.error("Unexpected error:", err);
  }

  res.status(statusCode).json({
    success: false,
    message
  });
};

export default errorMiddleware;