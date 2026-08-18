import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import auth from "./routes/auth.js";
import tasks from "./routes/tasks.js";
import ai from "./routes/ai.js";
import focus from "./routes/focus.js";
import settings from "./routes/settings.js";
import dashboard from "./routes/dashboard.js";

const app = express();

app.use(helmet());

const allowed = String(process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      // Requests from Postman/curl/server-side requests
      if (!origin) {
        return cb(null, true);
      }

      // Dashboard / configured frontend
      if (allowed.includes("*") || allowed.includes(origin)) {
        return cb(null, true);
      }

      // Chrome extension
      if (origin.startsWith("chrome-extension://")) {
        return cb(null, true);
      }

      // Local HTML file (development only)
      if (origin.startsWith("file://")) {
        return cb(null, true);
      }

      console.log("Blocked CORS origin:", origin);
      return cb(new Error("CORS blocked"));
    },
  }),
);

app.use(express.json({ limit: "256kb" }));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.get("/api/health", (_, res) =>
  res.json({
    ok: true,
    name: "FocusFlow AI",
    time: new Date().toISOString(),
  }),
);

app.use("/api/auth", auth);
app.use("/api/tasks", tasks);
app.use("/api/ai", ai);
app.use("/api/focus", focus);
app.use("/api/settings", settings);
app.use("/api/dashboard", dashboard);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    message: "Something went wrong on the server.",
  });
});

const port = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() =>
    app.listen(port, () =>
      console.log(`FocusFlow server on ${port}`),
    ),
  )
  .catch((e) => {
    console.error("MongoDB connection failed:", e.message);
    process.exit(1);
  });