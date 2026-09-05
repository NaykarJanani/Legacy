// ✅ Prevent XSS/Injection by encoding
export const sanitizeInput = (input: string) =>
  input.replace(/<[^>]*>?/gm, "");

// ✅ Token / User Management
export const getStoredUser = () => {
  const data = localStorage.getItem("user");
  return data ? JSON.parse(data) : null;
};
