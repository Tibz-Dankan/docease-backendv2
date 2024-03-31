import { rateLimit } from "express-rate-limit";

let requestLimit: number;
let requestWindowMs: number;

const isDevEnvironment: boolean = process.env.NODE_ENV === "developments";
const isProdEnvironment: boolean = process.env.NODE_ENV === "production";
const isTestEnvironment: boolean = process.env.NODE_ENV === "test";

if (isDevEnvironment || isProdEnvironment) {
  requestLimit = 75;
  requestWindowMs = 60 * 1000 * 5; // 5 min
} else if (isTestEnvironment) {
  requestLimit = 40;
  requestWindowMs = 60 * 1000; // 1 min
} else {
  requestLimit = 75;
  requestWindowMs = 60 * 1000 * 5; // 5 min
}

export const rateLimitController = rateLimit({
  windowMs: requestWindowMs,
  limit: requestLimit,
  message: "Too many requests, Try again later",
  legacyHeaders: true,
});
