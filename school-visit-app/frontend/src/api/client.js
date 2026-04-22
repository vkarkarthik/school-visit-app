import axios from "axios";

export const api = axios.create({
  baseURL: "https://school-visit-app-production.up.railway.app/api",
});