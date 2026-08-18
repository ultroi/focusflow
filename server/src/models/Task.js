import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxLength: 300 },
    description: { type: String, maxLength: 2000, default: "" },
    estimatedMinutes: { type: Number, min: 1, max: 480, default: 15 },
    completed: { type: Boolean, default: false },
    source: {
      type: String,
      enum: ["manual", "ai", "extension"],
      default: "manual",
    },
    createdAt: { type: Date, default: Date.now },
    completedAt: Date,
  },
  { timestamps: true },
);
export default mongoose.model("Task", schema);
