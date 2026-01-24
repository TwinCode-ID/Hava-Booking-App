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
app.use(helmet());
app.use(mongoSanitize());

const allowedOrigins = [env.DOMAIN_URL_1, env.DOMAIN_URL_2, env.APMLIFY_URL];

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
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

connectDB();

app.use(express.json());

app.use("/api/auth", authRoutes, authLimiter);
app.use("/api/user", userRoutes, generalLimiter);
app.use("/api/studio", studioRoutes, generalLimiter);
app.use("/api/package", packagesRoutes, generalLimiter);
app.use("/api/instructor", instructorsRoutes, generalLimiter);
app.use("/api/bookings", bookingRoutes, generalLimiter);
app.use("/api/schedule", scheduleRoutes, generalLimiter);
app.use("/api/purchases", purchaseRoutes, generalLimiter);
app.use("/api/passes", userPassRoutes, generalLimiter);
app.use("/api/medical", medicalRoutes, generalLimiter);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
