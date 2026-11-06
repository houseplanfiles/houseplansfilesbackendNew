const mongoose = require("mongoose");
const leadPreferenceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    frequency: {
      type: String,
      enum: ["weekly", "monthly", "yearly"],
      required: true,
    },
    leadCount: { type: Number, required: true, min: 1 },
    qualityPreference: {
      type: String,
      enum: ["all", "low", "medium", "high"],
      default: "all",
    },
    city: { type: String, default: "" },
    serviceType: { type: String, default: "" },
    budget: { type: String, default: "" },
    phone: { type: String, default: "" },
    notes: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "contacted", "approved", "rejected"],
      default: "pending",
    },
    adminNote: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LeadPreference", leadPreferenceSchema);
