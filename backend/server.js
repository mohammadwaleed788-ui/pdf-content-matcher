import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

import reconcileRoute from "./routes/reconcileRoute.js";

dotenv.config();

const app = express();

// ✅ Proper CORS configuration
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

// ✅ Mount route AFTER cors
app.use("/api", reconcileRoute);

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected");
    app.listen(process.env.PORT, () =>
      console.log(`Server running on port ${process.env.PORT}`)
    );
  })
  .catch((err) => console.log(err));
