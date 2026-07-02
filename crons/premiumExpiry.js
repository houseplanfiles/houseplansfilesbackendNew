const cron = require("node-cron");
const User = require("../models/userModel");

/**
 * Cron Job: Premium Expiry Checker
 * Runs every hour at minute 0.
 * Finds all contractors whose premiumExpiresAt is past & type is Premium,
 * then reverts them to Normal.
 */
const startPremiumExpiryCron = () => {
  cron.schedule("0 * * * *", async () => {
    try {
      const now = new Date();
      const result = await User.updateMany(
        {
          contractorType: "Premium",
          premiumExpiresAt: { $lte: now, $ne: null },
        },
        {
          $set: { contractorType: "Normal", premiumExpiresAt: null },
        }
      );

      if (result.modifiedCount > 0) {
        console.log(
          `[Cron] ✅ Premium expired: ${result.modifiedCount} contractor(s) reverted to Normal.`
        );
      } else {
        console.log("[Cron] ✔ No Premium subscriptions expired.");
      }
    } catch (error) {
      console.error("[Cron] ❌ Error running premium expiry job:", error);
    }
  });

  console.log("[Cron] 🕐 Premium expiry cron job registered (runs every hour).");
};

module.exports = startPremiumExpiryCron;
