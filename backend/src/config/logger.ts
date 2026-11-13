import winston from "winston";

const { combine, timestamp, printf, colorize, errors } = winston.format;

const line = printf(({ level, message, timestamp: ts, stack }) => `${ts} ${level}: ${stack || message}`);

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: combine(errors({ stack: true }), timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), line),
  transports: [
    new winston.transports.Console({ format: combine(colorize(), timestamp({ format: "HH:mm:ss" }), line) }),
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/app.log" }),
  ],
});
