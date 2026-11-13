import { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";
import { logger } from "../config/logger";
import { HttpError } from "../utils/http";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} not found.` });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message, details: err.details });
  }
  if (err instanceof MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "File is too large." : err.message;
    return res.status(400).json({ message });
  }
  // Friendly messages for common MySQL constraint errors
  switch (err?.code) {
    case "ER_DUP_ENTRY":
      return res.status(409).json({ message: "A record with this value already exists." });
    case "ER_ROW_IS_REFERENCED_2":
      return res.status(409).json({ message: "This record is in use by other records and cannot be deleted." });
    case "ER_NO_REFERENCED_ROW_2":
      return res.status(400).json({ message: "A selected related record does not exist." });
    case "ER_TRUNCATED_WRONG_VALUE":
    case "ER_TRUNCATED_WRONG_VALUE_FOR_FIELD":
    case "ER_DATA_TOO_LONG":
    case "WARN_DATA_TRUNCATED":
      return res.status(400).json({ message: "One of the values has an invalid format or is too long." });
  }
  logger.error(`${req.method} ${req.originalUrl} - ${err?.stack || err}`);
  res.status(500).json({ message: "Something went wrong on the server." });
}
