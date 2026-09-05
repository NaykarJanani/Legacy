import { sendMail } from "../aws/aws3.js";

const errorHandler = async (err, req, res, next) => {
  console.error("🔥 Error:", err.stack);

  const errorMessage = err?.message || "Internal Server Error";

  const subject = `🚨 Server Error Alert — ${req.method} ${req.originalUrl}`;
  
  const body = `
    <h3>Server Error Notification</h3>
    <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
    <p><strong>Endpoint:</strong> ${req.originalUrl}</p>
    <p><strong>Method:</strong> ${req.method}</p>
    <p><strong>RRN:</strong> ${req.rrn || "N/A"}</p>
    <p><strong>Error Message:</strong> ${errorMessage}</p>
    <pre style="background:#f4f4f4;padding:10px;border-radius:6px;">${err.stack}</pre>
    <p>— Server Monitor Bot 🤖</p>
  `;

  try {
    await sendMail("rpteqi@gmail.com", subject, body);
  } catch (mailError) {
    console.error("📧 Failed to send error email:", mailError);
  }
  
  res.status(500).json({
    rrn: req.rrn,
    success: false,
    message: errorMessage,
  });
};

export default errorHandler;
