import mongoose from "mongoose";
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  provider: String,
  model: String,
  requestType: String,
  tokensUsed: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});
schema.index({ userId: 1, createdAt: 1 });
export default mongoose.model("AIUsage", schema);
