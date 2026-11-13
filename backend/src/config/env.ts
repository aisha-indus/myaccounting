import dotenv from "dotenv";

dotenv.config();

const num = (v: string | undefined, fallback: number) => (v ? Number(v) : fallback);

export const env = {
  port: num(process.env.PORT, 5000),
  nodeEnv: process.env.NODE_ENV || "development",
  db: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: num(process.env.DB_PORT, 3306),
    name: process.env.DB_NAME || "ibms",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
  },
  jwtSecret: process.env.JWT_SECRET || "",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "2h",
  clientUrl: process.env.CLIENT_URL || "http://localhost:3000",
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: num(process.env.SMTP_PORT, 587),
    user: process.env.SMTP_USER || "",
    password: process.env.SMTP_PASSWORD || "",
    from: process.env.MAIL_FROM || "IBMS <no-reply@example.com>",
  },
  seedPassword: process.env.SEED_PASSWORD || "",
};

if (!env.jwtSecret) {
  throw new Error("JWT_SECRET is missing. Copy .env.example to .env and set it.");
}
