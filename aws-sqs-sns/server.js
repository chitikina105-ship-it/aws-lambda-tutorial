import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { createOrder } from "./controller/order.controller.js";
import errorMiddleware from "./middlewares/error.middleware.js";

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json());

app.post("/orders", createOrder);

// Centralized error middleware must be registered last
app.use(errorMiddleware);

app.listen(port, () => {
  console.log(`Orders API listening on port ${port}`);
});