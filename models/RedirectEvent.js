const mongoose = require("mongoose");

const RedirectEventSchema = new mongoose.Schema({
    url: { type: mongoose.Schema.Types.ObjectId, ref: "Url", required: true },
    ip: { type: String, default: "unknown" },
    userAgent: { type: String, default: "unknown" },
    device: { type: String, default: "unknown" },
    browser: { type: String, default: "unknown" },
    os: { type: String, default: "unknown" },
    referer: { type: String, default: "" },
    country: { type: String, default: "unknown" },
    city: { type: String, default: "unknown" },
    success: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model("RedirectEvent", RedirectEventSchema);
