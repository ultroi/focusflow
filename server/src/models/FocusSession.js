import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task" },
    duration: { type: Number, required: true, min: 1, max: 480 },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date },
    completed: { type: Boolean, default: false },
    interrupted: { type: Boolean, default: false },
  },
  { timestamps: true },
);
export default mongoose.model("FocusSession", schema);
