/**
 * @file axios.ts
 * @description Axios instance with httpOnly cookie-based auth.
 *
 * HOW IT WORKS:
 * Tokens live in httpOnly cookies set by the backend.
 * JS cannot read them — the browser sends them automatically.
 * withCredentials: true tells axios to include cookies on every request.
 *
 * If a request fails with 401:
 *   → Calls /auth/refresh-token (cookies sent automatically)
 *   → Backend rotates tokens via new cookies
 *   → Retries the original request
 */

// This code creates a smart API client that:

// Automatically sends your login info using cookies
// Automatically handles expired login (401 error)
// Automatically refreshes your login without you noticing

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { store } from '@/store';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // sends httpOnly cookies on every request automatically
});

// ─────────────────────────────────────────
// REQUEST INTERCEPTOR : A request interceptor is a function that runs before every API request is sent.
// Nothing to attach — org ID comes from route params, tokens from cookies

// Why do we use request interceptors?
// 1. Automatically add things to every request
// Example:
// config.headers.Authorization = `Bearer token`;
// 👉 You don’t have to manually add token in every API call.

// 2. Attach common data
// Example:
// Auth token
// Organization ID
// Language
// Headers like Content-Type
// ─────────────────────────────────────────

// api.interceptors.request.use(
//   (config: InternalAxiosRequestConfig) => config,
//   (error) => Promise.reject(error),
// );

// ─────────────────────────────────────────
// RESPONSE INTERCEPTOR — handles 401
// ─────────────────────────────────────────

// Why do we use response interceptors?

// 1. Handle errors globally
// Instead of writing error handling everywhere:
// try {
//   await api.get("/users");
// } catch (err) {
//   console.log(err);
// }

// 2. Handle authentication (VERY IMPORTANT)
//  Example: token expired (401)
// if (error.response?.status === 401) {
//   // refresh token
//   // retry request
// }
//  This is what your code is doing.

// 3. ❌ Without response interceptor
// You must handle errors everywhere:
// try {
//   await api.get("/data");
// } catch (err) {
//   if (err.status === 401) {
//     // refresh manually
//   }
// }
// 👉 Problem:
// Repeated code
// Easy to forget
// Messy
// ✅ With response interceptor
// api.interceptors.response.use(
//   (res) => res,
//   async (err) => {
//     if (err.response?.status === 401) {
//       // auto refresh + retry
//     }
//   }
// );
// 👉 Now:
// await api.get("/data");
// ✔ Everything handled automatically

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(null);
  });
  failedQueue = [];
};

// Routes that should NEVER trigger a refresh attempt
const SKIP_REFRESH_URLS = [
  '/auth/me',
  '/auth/refresh-token',
  '/auth/login',
  '/auth/register',
];

api.interceptors.response.use(
  (response) => response,

  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    const url = originalRequest.url || '';
    const shouldSkip = SKIP_REFRESH_URLS.some((u) => url.includes(u));

   // Don't attempt refresh for auth routes or already-retried requests
    if (error.response?.status === 401 && !originalRequest._retry && !shouldSkip) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => api(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Refresh token is in the httpOnly cookie — sent automatically
        await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh-token`,
          {},
          { withCredentials: true },
        );

        processQueue(null);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;

//NOTE:

// RESPONSE INTERCEPTOR (VERY IMPORTANT)

// This part handles:
// 👉 “What if my login expires?”

// Step 1: Request fails with 401
// if (error.response?.status === 401)
// 👉 Server says:
// “You are not logged in anymore”

// Step 2: Try to refresh login
// await axios.post('/auth/refresh-token', {}, { withCredentials: true });
// 👉 Important:
// You don’t send refresh token manually
// It is already in httpOnly cookie
// Browser sends it automatically

// Step 3: Backend sends new cookies
// Backend:
// verifies refresh token
// creates new access token
// updates cookies

// Step 4: Retry original request
// return api(originalRequest);
// 👉 Now request works again 🎉

// ⏳ 5. Handling multiple failed requests
// Sometimes many requests fail at once.
// So this part:
// let isRefreshing = false;
// let failedQueue = [];
// Meaning:
// 👉 “Only refresh token ONCE”
// Others wait in queue.
// Flow:
// First request → refresh token
// Others → wait in queue
// When refresh finishes → retry all

// 💥 6. If refresh fails
// window.location.href = '/login';
// 👉 If refresh token is also expired:
// User is logged out
// Redirect to login page