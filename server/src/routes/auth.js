import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
const r = Router();
const token = (u) =>
  jwt.sign(
    { id: u._id.toString(), email: u.email, name: u.name },
    process.env.JWT_SECRET || "dev-secret",
    { expiresIn: "7d" },
  );
r.post("/register", async (req, res) => {
  const name = String(req.body.name || "").trim(),
    email = String(req.body.email || "")
      .trim()
      .toLowerCase(),
    password = String(req.body.password || "");
  if (!name || !email || password.length < 6)
    return res
      .status(400)
      .json({
        message: "Name, valid email and 6+ character password are required",
      });
  if (await User.exists({ email }))
    return res.status(409).json({ message: "Email already registered" });
  const user = await User.create({
    name,
    email,
    passwordHash: await bcrypt.hash(password, 10),
  });
  res
    .status(201)
    .json({
      token: token(user),
      user: { id: user._id, name: user.name, email: user.email },
    });
});
r.post("/login", async (req, res) => {
  const email = String(req.body.email || "")
      .trim()
      .toLowerCase(),
    password = String(req.body.password || "");
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.passwordHash)))
    return res.status(401).json({ message: "Invalid email or password" });
  res.json({
    token: token(user),
    user: { id: user._id, name: user.name, email: user.email },
  });
});
export default r;
