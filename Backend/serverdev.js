require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");

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

const app = express();

// 1. Core Configurations
app.set("trust proxy", 1);
connectDB();

// 2. Global Middleware (Order matters!)
app.use(express.json()); // Body parser must be before routes

app.use((req, res, next) => {
  Object.defineProperty(req, "query", {
    value: { ...req.query },
    writable: true,
    configurable: true,
    enumerable: true,
  });
  next();
});

// 3. CORS & Security
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
  }),
);

app.use(
  helmet({
    // Fixes the "Cancelled load" error for images in your screenshot
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

app.use(mongoSanitize());

// 4. Custom Middleware Logic
const protectAPI = (req, res, next) => {
  // Fixes the 502/Preflight error: Browsers don't send x-api-key on OPTIONS
  if (req.method === "OPTIONS") {
    return next();
  }

  const clientSecret = req.headers["x-api-key"] || req.query["x-api-key"];
  if (clientSecret === process.env.INTERNAL_API_KEY) {
    next();
  } else {
    res.status(403).json({ message: "Forbidden: Invalid API Key" });
  }
};

// 5. Rate Limiters
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  message: "Too many requests, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false,
});

// Increased from 5 to 20 to prevent "re-login lockout" during testing
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: "Too many login attempts. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// 6. Routes (Limiter and ProtectAPI MUST come before the routes)
app.use("/api/auth", protectAPI, authLimiter, authRoutes); // Corrected order
app.use("/api/user", protectAPI, userRoutes);
app.use("/api/studio", protectAPI, studioRoutes);
app.use("/api/package", protectAPI, packagesRoutes);
app.use("/api/instructor", protectAPI, instructorsRoutes);
app.use("/api/bookings", protectAPI, bookingRoutes);
app.use("/api/schedule", protectAPI, scheduleRoutes);
app.use("/api/purchases", protectAPI, purchaseRoutes);
app.use("/api/passes", protectAPI, userPassRoutes);
app.use("/api/medical", protectAPI, medicalRoutes);

// Static files (Images)
app.use(
  "/uploads",
  protectAPI,
  express.static(path.join(__dirname, "uploads")),
);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
