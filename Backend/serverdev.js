require("dotenv").config();
const express = require("express");
const http = require("http"); // 1. Import HTTP
const { Server } = require("socket.io"); // 2. Import Socket.io
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
const studioConfigRoutes = require("./routes/StudioRoutes/studioConfigRoutes");

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: "*", // Matches your Frontend
    methods: ["GET", "POST"],
  },
});

app.set("io", io);

io.on("connection", (socket) => {
  console.log(`Socket Connected: ${socket.id}`);

  // Admin Room
  socket.on("join_studio_admin_room", (studioId) => {
    if (studioId) {
      socket.join(studioId);
      console.log(`Socket ${socket.id} joined STUDIO admin room: ${studioId}`);
    }
  });

  // Client Room
  socket.on("join_user_room", (userId) => {
    if (userId) {
      socket.join(userId);
      console.log(`Socket ${socket.id} joined USER room: ${userId}`);
    }
  });

  socket.on("disconnect", () => {
    console.log("Socket Disconnected", socket.id);
  });
});

// --- CORE CONFIGURATIONS ---
app.set("trust proxy", 1);
connectDB();

// --- GLOBAL MIDDLEWARE ---
app.use(express.json());

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

// CORS & Security
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
  }),
);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

app.use(mongoSanitize());

// --- CUSTOM MIDDLEWARE ---
const protectAPI = (req, res, next) => {
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

// --- RATE LIMITERS ---
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  message: "Too many requests, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: "Too many login attempts. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// --- ROUTES ---
app.use("/api/auth", protectAPI, authRoutes);
app.use("/api/user", protectAPI, userRoutes);
app.use("/api/studio", protectAPI, studioRoutes);
app.use("/api/package", protectAPI, packagesRoutes);
app.use("/api/instructor", protectAPI, instructorsRoutes);
app.use("/api/bookings", protectAPI, bookingRoutes);
app.use("/api/schedule", protectAPI, scheduleRoutes);
app.use("/api/purchases", protectAPI, purchaseRoutes);
app.use("/api/passes", protectAPI, userPassRoutes);
app.use("/api/medical", protectAPI, medicalRoutes);
app.use("/api/config", protectAPI, studioConfigRoutes);

// Static files
app.use(
  "/uploads",
  protectAPI,
  express.static(path.join(__dirname, "uploads")),
);

// --- SERVER LISTEN ---
const PORT = process.env.PORT || 5000;

// IMPORTANT: Change app.listen -> server.listen
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
