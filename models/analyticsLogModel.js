const mongoose = require("mongoose");

const analyticsLogSchema = mongoose.Schema(
  {
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'targetModel'
    },
    targetModel: {
      type: String,
      required: true,
      enum: ['User', 'Product', 'ProfessionalPlan', 'SellerProduct']
    },
    action: {
      type: String,
      required: true,
    },
    ipAddress: {
      type: String,
      required: true,
    }
  },
  {
    timestamps: true,
  }
);

// Compound index to quickly find if an IP has already performed an action on a target
analyticsLogSchema.index({ targetId: 1, action: 1, ipAddress: 1 });

const AnalyticsLog = mongoose.model("AnalyticsLog", analyticsLogSchema);

module.exports = AnalyticsLog;
