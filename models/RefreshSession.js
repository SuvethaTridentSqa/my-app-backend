const mongoose = require("mongoose");

const RefreshSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sessionId: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ["active", "rotated", "revoked"],
      default: "active",
      required: true,
    },
    expiresAt: { type: Date, required: true, index: true },
    purgeAt: { type: Date, required: true, index: { expires: 0 } },
    lastUsedAt: { type: Date, default: null },
    replacedByHash: { type: String, default: null },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

module.exports =
  mongoose.models.RefreshSession ||
  mongoose.model("RefreshSession", RefreshSessionSchema);
