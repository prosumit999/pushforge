require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const connectDB = require("./Config/db.config");
const securityMiddleware = require("./Middlewares/security.middleware");

const authRoutes = require("./Routes/auth.routes");
const websiteRoutes = require("./Routes/website.routes");
const publicRoutes = require("./Routes/public.routes");
const subscriberRoutes = require("./Routes/subscriber.routes");
const segmentRoutes = require("./Routes/segment.routes");
const notificationRoutes = require("./Routes/notification.routes");
const analyticsRoutes = require("./Routes/analytics.routes");

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(securityMiddleware);

app.use(express.static(path.join(__dirname, "public")));

app.get("/sdk.js", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/javascript");
  res.sendFile(path.join(__dirname, "public", "pushforge-sdk.js"));
});

app.get("/pushforge-sw.js", (req, res) => {
  res.setHeader("Service-Worker-Allowed", "/");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/javascript");
  res.sendFile(path.join(__dirname, "public", "pushforge-sw.js"));
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "PushForge Backend",
    timestamp: new Date().toISOString()
  });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/websites", websiteRoutes);
app.use("/api/v1/public", publicRoutes);
app.use("/api/v1/subscribers", subscriberRoutes);
app.use("/api/v1/segments", segmentRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/analytics", analyticsRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message || "Internal Server Error"
  });
});

const start = async () => {
  try {
    await connectDB();
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`PushForge backend running on port ${PORT}`);
    });
  } catch (error) {
    console.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

start();

module.exports = app;