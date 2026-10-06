require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const connectDB = require("./Config/db.config");
const { validateEnvironment } = require("./Config/env.config");
const {
  securityMiddleware,
  productionAuthLimiter,
  productionPublicLimiter
} = require("./Middlewares/security.middleware");

// Fail-fast Environment Validation for Production Security
validateEnvironment();

const authRoutes = require("./Routes/auth.routes");
const websiteRoutes = require("./Routes/website.routes");
const publicRoutes = require("./Routes/public.routes");
const subscriberRoutes = require("./Routes/subscriber.routes");
const segmentRoutes = require("./Routes/segment.routes");
const notificationRoutes = require("./Routes/notification.routes");
const analyticsRoutes = require("./Routes/analytics.routes");
const emailRoutes = require("./Routes/email.routes");
const superadminRoutes = require("./Routes/superadmin.routes");
const affiliateRoutes = require("./Routes/affiliate.routes");
const paymentRoutes = require("./Routes/payment.routes");
const blogRoutes = require("./Routes/blog.routes");

const app = express();

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
  process.env.CORS_ORIGIN
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== "production") {
        callback(null, true);
      } else {
        callback(null, origin);
      }
    },
    credentials: true
  })
);

app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  })
);
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

app.get("/", (req, res) => {
  res.status(200).json({
    message: "meoww 🐾",
    status: "online",
    service: "PushForge Backend API Engine",
    version: "v1.0.0"
  });
});

app.get("/health", (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  res.status(dbConnected ? 200 : 503).json({
    status: dbConnected ? "ok" : "database_disconnected",
    dbState: mongoose.connection.readyState,
    service: "PushForge Backend",
    timestamp: new Date().toISOString()
  });
});

app.get("/api/v1/system/worker-status", async (req, res) => {
  const startTime = Date.now();
  try {
    const goUrl = process.env.GO_WORKER_HEALTH_URL || "http://127.0.0.1:8080/health";
    const goRes = await fetch(goUrl, { signal: AbortSignal.timeout(2000) });
    const latencyMs = Date.now() - startTime;
    if (goRes.ok) {
      const data = await goRes.json();
      return res.status(200).json({
        active: true,
        latencyMs,
        engine: data.engine || "Golang Concurrency (500+ Goroutines)",
        service: data.service || "PushForge High-Speed Go Worker Engine",
        status: data.status || "ok"
      });
    }
  } catch (err) {
    // Fallback status if Go engine is unreachable
  }
  return res.status(200).json({
    active: false,
    latencyMs: Date.now() - startTime,
    engine: "Node.js Fallback Worker",
    service: "Node.js Async Batch Engine",
    status: "fallback"
  });
});

// Guard API routes if Database is not connected
app.use("/api/v1", (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      error: "Database Connection Error: Backend is not connected to MongoDB. Please configure MONGO_URI in deployment environment variables."
    });
  }
  next();
});

app.use("/api/v1/auth", productionAuthLimiter, authRoutes);
app.use("/api/v1/websites", websiteRoutes);
app.use("/api/v1/public", productionPublicLimiter, publicRoutes);
app.use("/api/v1/subscribers", subscriberRoutes);
app.use("/api/v1/segments", segmentRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/analytics", analyticsRoutes);
app.use("/api/v1/collected-emails", emailRoutes);
app.use("/api/v1/superadmin", superadminRoutes);
app.use("/api/v1/affiliate", affiliateRoutes);
app.use("/api/v1/payment", paymentRoutes);
app.use("/api/v1/blogs", blogRoutes);


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

const schedulerService = require("./Services/scheduler.service");
const queueWorker = require("./Services/queue.worker");
const weeklyDigestWorker = require("./Services/weeklyDigest.worker");

const start = async () => {
  try {
    await connectDB();
    schedulerService.startScheduler();
    queueWorker.startQueueWorker();
    weeklyDigestWorker.startWeeklyDigestWorker();
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