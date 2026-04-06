const DEFAULT_API_BASE_URL = import.meta.env.PROD
  ? (typeof window !== "undefined" ? window.location.origin : "")
  : "http://localhost:5000";

const configuredBaseUrl = String(import.meta.env.VITE_API_BASE_URL || "").trim();

export const API_BASE_URL = (configuredBaseUrl || DEFAULT_API_BASE_URL).replace(/\/+$/, "");

export const apiUrl = (path) => {
  if (typeof path !== "string") return API_BASE_URL;
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

export const toUserErrorMessage = (error, fallbackMessage) => {
  const message = String(error?.message || "").trim();
  if (!message || message.toLowerCase() === "failed to fetch") {
    return fallbackMessage || "Unable to reach the server. Check that backend is running.";
  }
  return message;
};
