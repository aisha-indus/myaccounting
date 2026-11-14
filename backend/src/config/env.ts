import dotenv from "dotenv";

// ENV_FILE lets a script read another file, e.g. .env.cloud for the online database.
dotenv.config({ path: process.env.ENV_FILE || ".env" });

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
    /** Cloud MySQL (Aiven, TiDB, Railway...) requires an encrypted connection. */
    ssl: process.env.DB_SSL === "true",
    /** Optional CA certificate (PEM text) so the server certificate is verified too. */
    sslCa: (process.env.DB_SSL_CA || "").replace(/\\n/g, "\n").trim(),
  },
  /** Running as a Vercel function: the disk is read-only except /tmp, and nothing runs between requests. */
  serverless: !!process.env.VERCEL,
  /** Writable folder for logs and uploads. */
  dataDir: process.env.VERCEL ? "/tmp" : process.cwd(),
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

/** mysql2 SSL options: encrypted when DB_SSL=true, and the certificate is checked when DB_SSL_CA is set. */
export const sslOptions = () =>
  env.db.ssl ? (env.db.sslCa ? { ca: env.db.sslCa, rejectUnauthorized: true } : { rejectUnauthorized: false }) : undefined;

if (!env.jwtSecret) {
  throw new Error("JWT_SECRET is missing. Copy .env.example to .env and set it.");
}
