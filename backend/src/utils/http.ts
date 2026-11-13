export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) => new HttpError(400, message, details);
export const forbidden = (message = "You do not have permission to do this.") => new HttpError(403, message);
export const notFound = (what = "Record") => new HttpError(404, `${what} not found.`);

export const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
export const toNum = (v: unknown) => (v === null || v === undefined || v === "" ? 0 : Number(v) || 0);
