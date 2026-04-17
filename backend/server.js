import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import reconcileRoute from "./routes/reconcileRoute.js";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

app.use("/api", reconcileRoute);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
