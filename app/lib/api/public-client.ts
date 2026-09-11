import axios from "axios";

/**
 * A bare client for the unauthenticated endpoints.
 *
 * Deliberately NOT the shared apiClient: its response interceptor clears
 * tokens and redirects to /login on any 401. These endpoints never 401, but a
 * visitor carrying a stale token in localStorage should never be at risk of
 * being bounced out of a public page — and no page reached from an email can
 * assume the reader is signed in at all.
 *
 * Shared rather than re-rolled per feature, so a change to the base URL or the
 * timeout cannot apply to the forms endpoints and miss the tracking one.
 */
export const publicClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8001/api",
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});
