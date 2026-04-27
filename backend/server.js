import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import reconcileRoute from "./routes/reconcileRoute.js";
import authRoute from "./routes/authRoute.js";

dotenv.config();

const app = express();

const allowedOrigins = (
  process.env.CORS_ORIGINS ||
  "http://localhost:5173,http://208.110.83.16:8085"
).split(",").map((s) => s.trim());

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json());

app.use("/api", reconcileRoute);
app.use("/api/auth", authRoute);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));