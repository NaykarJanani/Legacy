const apiResponse = (success, message, data = null, rrn = null) => {
  return {
    rrn,
    success,
    message,
    data,
  };
};

export default apiResponse;
