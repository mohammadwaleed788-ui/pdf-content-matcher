import express from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const credentialsPath = path.join(__dirname, "..", "data", "userCredentials.json");

const getSubscriptionStatus = (approvalDateString) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const approvalDate = new Date(approvalDateString);
  approvalDate.setHours(0, 0, 0, 0);

  if (Number.isNaN(approvalDate.getTime())) {
    return { validDate: false, isActive: false };
  }

  return {
    validDate: true,
    isActive: today < approvalDate,
  };
};

const readStoredUser = async () => {
  const fileContent = await fs.readFile(credentialsPath, "utf-8");
  return JSON.parse(fileContent);
};

router.get("/subscription-status", async (_req, res) => {
  try {
    const storedUser = await readStoredUser();
    const status = getSubscriptionStatus(storedUser.approvalDate);

    if (!status.validDate) {
      return res.status(500).json({ message: "Invalid approval date in backend file" });
    }

    return res.json({
      isActive: status.isActive,
      approvalDate: storedUser.approvalDate,
    });
  } catch (error) {
    console.error("Subscription check error:", error);
    return res.status(500).json({ message: "Subscription check failed" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const storedUser = await readStoredUser();

    if (email !== storedUser.email || password !== storedUser.password) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const status = getSubscriptionStatus(storedUser.approvalDate);

    if (!status.validDate) {
      return res.status(500).json({ message: "Invalid approval date in backend file" });
    }

    if (!status.isActive) {
      return res.status(403).json({ message: "Subscription expired" });
    }

    return res.json({ message: "Login successful", approvalDate: storedUser.approvalDate });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Login failed" });
  }
});

export default router;