import fs from "fs";
import path from "path";
import multer from "multer";
import { env } from "../config/env";
import { badRequest } from "../utils/http";

// On Vercel only /tmp is writable and it is wiped between runs, so uploads there are temporary.
export const UPLOAD_DIR = path.resolve(env.dataDir, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const IMAGE = [".jpg", ".jpeg", ".png", ".webp"];
const DOCS = [".pdf", ".doc", ".docx", ...IMAGE];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${file.fieldname}-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  },
});

/** Team member files: profile picture (image) and CNIC / CV / contract (PDF, DOC or image), max 5MB each. */
export const teamMemberUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = file.fieldname === "profile_picture" ? IMAGE : DOCS;
    if (!allowed.includes(ext)) return cb(badRequest(`${file.fieldname}: file type ${ext || "unknown"} is not allowed.`));
    cb(null, true);
  },
}).fields([
  { name: "profile_picture", maxCount: 1 },
  { name: "cnic_upload", maxCount: 1 },
  { name: "cv_upload", maxCount: 1 },
  { name: "contract_upload", maxCount: 1 },
]);
