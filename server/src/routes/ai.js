import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { aiRequest, getUsage } from "../services/ai.js";
const r = Router();
r.use(auth);
const base = `You are FocusFlow AI, a gentle ADHD-friendly productivity assistant. You are NOT a clinician and must not diagnose, treat, or make medical claims. Reduce overwhelm and activation energy. Use short, concrete, non-judgmental language. Prefer one tiny next action. Never shame the user.`;
const clean = (v, max) =>
  String(v || "")
    .slice(0, max)
    .trim();
async function ask(req, res, type, user, { json = false } = {}) {
  try {
    const out = await aiRequest({
      userId: req.user.id,
      type,
      messages: [
        { role: "system", content: base },
        { role: "user", content: user },
      ],
      json,
    });
    let result = out.text;
    try {
      if (json) result = JSON.parse(result);
    } catch {}
    res.json({ result, provider: out.provider, remaining: out.remaining });
  } catch (e) {
    console.error("AI:", e.message, e.detail || "");
    res
      .status(e.status || 503)
      .json({
        message:
          e.message === "daily_limit"
            ? "Daily free AI limit reached. Your focus tools still work."
            : "AI is temporarily unavailable. Check your provider keys/limits.",
      });
  }
}
r.post("/next-action", (req, res) =>
  ask(
    req,
    res,
    "next-action",
    `Task: ${clean(req.body.task, 1200)}\nReturn JSON: {"nextAction":"...","estimatedMinutes":number,"encouragement":"..."}. The next action must be small enough to start within 10-20 minutes.`,
    { json: true },
  ),
);
r.post("/stuck", (req, res) =>
  ask(
    req,
    res,
    "stuck",
    `Task: ${clean(req.body.task, 1200)}\nBlocker: ${clean(req.body.blocker, 600)}\nReturn JSON: {"tinyAction":"...","reassurance":"...","minutes":number}. Make the action embarrassingly easy to start.`,
    { json: true },
  ),
);
r.post("/task-breakdown", (req, res) =>
  ask(
    req,
    res,
    "task-breakdown",
    `Task: ${clean(req.body.task, 1800)}\nTime available: ${Number(req.body.minutes || 60)} minutes. Return JSON {"steps":[{"title":"...","description":"...","estimatedMinutes":number}]} with 3-6 small concrete steps and a realistic total <= available time.`,
    { json: true },
  ),
);
r.post("/daily-plan", (req, res) =>
  ask(
    req,
    res,
    "daily-plan",
    `Tasks: ${clean(req.body.tasks, 5000)}\nAvailable minutes: ${Number(req.body.minutes || 120)}. Return JSON {"plan":[{"title":"...","start":"...","minutes":number,"break":boolean}]} with short work blocks and real breaks.`,
    { json: true },
  ),
);
r.post("/summarize", (req, res) =>
  ask(
    req,
    res,
    "summarize",
    `Summarize this webpage for a student. Return JSON {"summary":"...","keyPoints":["..."],"takeaway":"...","readingMinutes":number}. Keep it concise.\n\n${clean(req.body.text, 12000)}`,
    { json: true },
  ),
);
r.post("/simplify", (req, res) =>
  ask(
    req,
    res,
    "simplify",
    `Simplify the following text for a student. Return JSON {"explanation":"...","example":"...","takeaway":"..."}.\n\n${clean(req.body.text, 6000)}`,
    { json: true },
  ),
);
r.get("/usage", async (req, res) => res.json(await getUsage(req.user.id)));
export default r;
