import axios from "axios";
import { getStoredUser } from "../utils/security";
import { toast } from "react-toastify";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  headers: { "Content-Type": "application/json" },
});


// Request Interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  const user = getStoredUser();

  if (token) config.headers.Authorization = `Bearer ${token}`;
  const temp = config.url;
  
  if (user?.role && temp) {
  config.url = `/api/${user.role === "customer" ? "user" : user.role}${temp}`;
}
    


  return config;
});

// Response Interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {


    if (!error.response) {
      // No response received, it’s a network error
      if (error.code === 'ERR_NETWORK') {
        toast.error('Network Error - Could not reach the server');
      }
      return Promise.reject(error);
    }

    if (error.response && error.response.status === 401 || error.response.status === 403) {
       const message = error.response?.data?.message || "";
      if (message.toLowerCase().includes("disabled")) {
        toast.error("Your account has been disabled. Please contact admin.");
      }
      window.location.href = "/logout";
    }
    return Promise.reject(error);
  }
);



export default api;
