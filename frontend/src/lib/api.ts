import axios, { AxiosError } from "axios";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
/** Base for uploaded files (the API serves them at /uploads). */
export const FILES_URL = API_URL.replace(/\/api\/?$/, "");

const TOKEN_KEY = "ibms_token";
export const getToken = () => (typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY));
export const setToken = (token: string | null) => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
};

export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const AUTH_PAGES = ["/login", "/register", "/forgot-password", "/reset-password"];

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    // Session expired (2h inactivity, SRS 5.2): send the user back to sign in.
    if (error.response?.status === 401 && typeof window !== "undefined" && !AUTH_PAGES.includes(window.location.pathname)) {
      setToken(null);
      window.location.href = "/login?expired=1";
    }
    return Promise.reject(error);
  }
);

export function errorMessage(error: unknown): string {
  const e = error as AxiosError<{ message?: string }>;
  if (e?.response?.data?.message) return e.response.data.message;
  if (e?.code === "ERR_NETWORK") return "Cannot reach the server. Check that the backend is running.";
  return "Something went wrong. Please try again.";
}
