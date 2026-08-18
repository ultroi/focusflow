import { Router } from "express";
import { auth } from "../middleware/auth.js";
import Task from "../models/Task.js";
import FocusSession from "../models/FocusSession.js";
import { getUsage } from "../services/ai.js";
const r = Router();
r.use(auth);
r.get("/", async (req, res) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const [tasks, sessions, usage] = await Promise.all([
    Task.find({ userId: req.user.id }),
    FocusSession.find({ userId: req.user.id, startedAt: { $gte: start } }),
    getUsage(req.user.id),
  ]);
  res.json({
    tasks: {
      total: tasks.length,
      completed: tasks.filter((t) => t.completed).length,
      pending: tasks.filter((t) => !t.completed).length,
    },
    focus: {
      sessions: sessions.length,
      minutes: sessions.reduce((a, s) => a + s.duration, 0),
      interrupted: sessions.filter((s) => s.interrupted).length,
    },
    ai: usage,
  });
});
export default r;
