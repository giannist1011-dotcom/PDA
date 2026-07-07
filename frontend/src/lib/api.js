import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

export const fetchNextOrderNumber = async () => {
  const { data } = await api.get("/orders/next-number");
  return data.next_order_number;
};

export const submitOrder = async (payload) => {
  const { data } = await api.post("/orders", payload);
  return data;
};

export const fetchAnalytics = async (dateFrom, dateTo) => {
  const params = {};
  if (dateFrom) params.date_from = dateFrom;
  if (dateTo) params.date_to = dateTo;
  const { data } = await api.get("/analytics", { params });
  return data;
};

export const fetchOrders = async (dateFrom, dateTo) => {
  const params = {};
  if (dateFrom) params.date_from = dateFrom;
  if (dateTo) params.date_to = dateTo;
  const { data } = await api.get("/orders", { params });
  return data;
};
