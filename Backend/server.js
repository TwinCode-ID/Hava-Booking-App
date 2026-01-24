require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");

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
const { env } = require("process");

const app = express();

app.use((req, res, next) => {
  Object.defineProperty(req, "query", {
    value: { ...req.query },
    writable: true,
    configurable: true,
    enumerable: true,
  });
  next();
});

app.use(helmet());
app.use(mongoSanitize());

const protectAPI = (req, res, next) => {
  // 1. Get the secret from the request headers
  const clientSecret = req.headers["x-api-key"];

  // 2. Compare it to your server-side environment variable
  if (clientSecret === process.env.INTERNAL_API_KEY) {
    next(); // Valid key, proceed to the routes
  } else {
    // 3. Block everything else (Postman, other scripts)
    res.status(403).json({
      message:
        "Forbidden: Direct API access is restricted to the authorized application only.",
    });
  }
};

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100,
  message: "Too many requests from this IP, please try again after 15 minutes",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// 2. Strict limiter for Auth: Max 5 attempts per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: "Too many login attempts. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

app.set("trust proxy", 1);

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
connectDB();

app.use(express.json());

app.use("/api/auth", protectAPI, authRoutes, authLimiter);
app.use("/api/user", protectAPI, userRoutes, generalLimiter);
app.use("/api/studio", protectAPI, studioRoutes, generalLimiter);
app.use("/api/package", protectAPI, packagesRoutes, generalLimiter);
app.use("/api/instructor", protectAPI, instructorsRoutes, generalLimiter);
app.use("/api/bookings", protectAPI, bookingRoutes, generalLimiter);
app.use("/api/schedule", protectAPI, scheduleRoutes, generalLimiter);
app.use("/api/purchases", protectAPI, purchaseRoutes, generalLimiter);
app.use("/api/passes", protectAPI, userPassRoutes, generalLimiter);
app.use("/api/medical", protectAPI, medicalRoutes, generalLimiter);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
