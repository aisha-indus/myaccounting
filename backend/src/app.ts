import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { UPLOAD_DIR } from "./middleware/upload";
import routes from "./routes";

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: env.clientUrl.split(",").map((s) => s.trim()) }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  const started = Date.now();
  res.on("finish", () => logger.debug(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - started}ms`));
  next();
});

app.use("/uploads", express.static(UPLOAD_DIR));
app.use("/api", routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
