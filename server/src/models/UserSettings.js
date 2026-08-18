import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      unique: true,
      index: true,
    },
    focusDefault: { type: Number, default: 25 },
    distractionDetection: { type: Boolean, default: true },
    saveAIHistory: { type: Boolean, default: false },
    reduceMotion: { type: Boolean, default: false },
    blockedDomains: {
      type: [String],
      default: [
        "youtube.com",
        "instagram.com",
        "reddit.com",
        "x.com",
        "facebook.com",
      ],
    },
    timezone: { type: String, default: "Asia/Kolkata" },
  },
  { timestamps: true },
);
export default mongoose.model("UserSettings", schema);
