require("dotenv").config();
const {
  validateSecurityEnvironment,
} = require("./config/validateSecurityEnv");
validateSecurityEnvironment();
require("./cron/expiryReminderJob");
require("./cron/orphanUploadCleanupJob");

const express = require("express");
const http = require("http"); // 1. Import HTTP
const { Server } = require("socket.io"); // 2. Import Socket.io
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const {
  corsOptions,
  getTrustProxySetting,
  isOriginAllowed,
} = require("./config/security");
const {
  configureAuthenticatedSockets,
} = require("./config/socketSecurity");
const { logAuthError } = require("./helper/authSecurity");
const {
  verifyPrivateUploadSignature,
} = require("./helper/privateUpload");
const {
  generalApiLimiter,
} = require("./middlewares/rateLimitMiddleware");

// Route Imports
const authRoutes = require("./routes/UserRoutes/authRoutes");
const userRoutes = require("./routes/UserRoutes/userRoutes");
const studioRoutes = require("./routes/StudioRoutes/studioRoutes");
const packagesRoutes = require("./routes/StudioRoutes/packagesRoutes");
const instructorsRoutes = require("./routes/StudioRoutes/instructorsRoutes");
const bookingRoutes = require("./routes/BookingRoutes/bookingRoutes");
const scheduleRoutes = require("./routes/BookingRoutes/scheduleRoutes");
const purchaseRoutes = require("./routes/StudioRoutes/purchaseRoutes");
const userPassRoutes = require("./routes/UserRoutes/user_passesRoutes");
const medicalRoutes = require("./routes/UserRoutes/medicalRoutes");
const studioConfigRoutes = require("./routes/StudioRoutes/studioConfigRoutes");
const chatRoutes = require("./routes/MessagingRoutes/chatRoutes");
const promo = require("./routes/StudioRoutes/promoRoutes");

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  allowRequest: (req, callback) =>
    callback(null, isOriginAllowed(req.headers.origin)),
  cors: corsOptions,
  maxHttpBufferSize: 1e6,
});

app.set("io", io);
configureAuthenticatedSockets(io);

// --- CORE CONFIGURATIONS ---
app.set("trust proxy", getTrustProxySetting());
app.disable("x-powered-by");
connectDB();

// --- GLOBAL MIDDLEWARE ---
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(cors(corsOptions));
app.use("/api", generalApiLimiter);
app.use(express.json({ limit: "1mb", strict: true }));
app.use(express.urlencoded({ limit: "1mb", extended: false }));

app.use((req, res, next) => {
  Object.defineProperty(req, "query", {
    value: { ...req.query },
    writable: true,
    configurable: true,
    enumerable: true,
  });
  next();
});

app.get("/.well-known/apple-app-site-association", (req, res) => {
  res.set("Content-Type", "application/json");
  res.sendFile(path.join(__dirname, "apple-app-site-association"));
});

app.use(mongoSanitize());

// --- ROUTES ---
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/studio", studioRoutes);
app.use("/api/package", packagesRoutes);
app.use("/api/instructor", instructorsRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/schedule", scheduleRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use("/api/passes", userPassRoutes);
app.use("/api/medical", medicalRoutes);
app.use("/api/config", studioConfigRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/promos", promo);

// Public-facing profile/studio media is intentionally public. Payment proofs
// are served only through short-lived, server-signed URLs issued after an
// authorized purchase lookup.
app.use(
  "/uploads/UserProfile",
  express.static(path.join(__dirname, "uploads", "UserProfile"), {
    immutable: true,
    maxAge: "1d",
  }),
);
app.use(
  "/uploads/Studio",
  express.static(path.join(__dirname, "uploads", "Studio"), {
    immutable: true,
    maxAge: "1d",
  }),
);
app.use(
  "/uploads/ProofOfPurchase",
  verifyPrivateUploadSignature,
  express.static(path.join(__dirname, "uploads", "ProofOfPurchase")),
);

app.use((error, _req, res, _next) => {
  if (error?.code === "CORS_NOT_ALLOWED") {
    return res.status(403).json({ message: "Origin is not allowed." });
  }
  if (error?.type === "entity.too.large") {
    return res.status(413).json({ message: "Request body is too large." });
  }
  if (error?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ message: "Image file is too large." });
  }
  if (error?.code === "UPLOAD_QUOTA_EXCEEDED") {
    return res.status(413).json({ message: "Upload storage limit reached." });
  }
  if (
    error?.code === "INVALID_IMAGE_TYPE" ||
    error?.code === "INVALID_IMAGE_DATA"
  ) {
    return res.status(400).json({ message: "The uploaded image is invalid." });
  }

  logAuthError("Unhandled request error", error);
  return res.status(500).json({ message: "Internal server error." });
});

// --- SERVER LISTEN ---
const PORT = process.env.PORT || 5000;

// IMPORTANT: Change app.listen -> server.listen
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
