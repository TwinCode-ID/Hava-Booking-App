require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");

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

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

connectDB();

app.use(express.json());

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

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
