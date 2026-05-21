import axios from "axios";

const base = import.meta.env.BASE_URL.replace(/\/$/, "");

const api = axios.create({
  baseURL: `${base}/api`,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
