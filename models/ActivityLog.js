const mongoose = require("mongoose");

const ActivityLogSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    type: { type: String, required: true },
    action: { type: String, required: true },
    metadata: { type: Object, default: {} },
}, { timestamps: true });

module.exports = mongoose.model("ActivityLog", ActivityLogSchema);
