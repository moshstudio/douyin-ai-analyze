import axios from "axios";

const TIKHUB_TOKEN = process.env.TIKHUB_TOKEN;
const TIKHUB_BASE_URL =
  process.env.TIKHUB_BASE_URL || "https://api.tikhub.io/api/v1";

if (!TIKHUB_TOKEN) {
  console.warn("TIKHUB_TOKEN is not configured in environment variables");
}

export const tikhubClient = axios.create({
  baseURL: TIKHUB_BASE_URL,
  headers: {
    "Content-Type": "application/json",
    Authorization: TIKHUB_TOKEN ? `Bearer ${TIKHUB_TOKEN}` : "",
  },
});

// Response interceptor to simplify data access and handle errors
tikhubClient.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    const status = error.response?.status;
    const statusText = error.response?.statusText;
    const message = error.response?.data?.message || error.message;

    console.error(`TikHub API Error [${status} ${statusText}]:`, message);

    return Promise.reject(
      new Error(
        `TikHub API error: ${status ? `${status} ${statusText}` : message}`
      )
    );
  }
);
