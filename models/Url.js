const mongoose = require("mongoose");

const UrlSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    originalUrl: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    passwordHash: { type: String, default: null },
    title: { type: String, default: "" },
    description: { type: String, default: "" },
    clicks: { type: Number, default: 0 },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Url", UrlSchema);
