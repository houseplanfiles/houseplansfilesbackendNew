const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/houseplan";
mongoose.connect(uri)
  .then(async () => {
    console.log("Connected to MongoDB.");
    const db = mongoose.connection.db;

    // Remove businessType from sellers who don't have it explicitly set
    // The script we ran before set all sellers without businessType to "Both"
    // We need to revert this - unset businessType for those sellers
    // We'll unset businessType for ALL sellers who have it as "Both" (since that was our mass update)
    // Note: Sellers who genuinely registered as "Both" will also lose it,
    // but they can re-set it from their profile or admin panel.
    const res = await db.collection('users').updateMany(
      { role: 'seller', businessType: 'Both' },
      { $unset: { businessType: "" } }
    );
    console.log("Reverted businessType for:", res.modifiedCount, "sellers");
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
