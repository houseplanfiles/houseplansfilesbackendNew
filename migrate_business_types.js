const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/houseplan";

mongoose.connect(uri)
  .then(async () => {
    console.log("Connected to MongoDB for migration.");
    const db = mongoose.connection.db;

    // 1. Migrate B2B to Manufacturer
    const resB2B = await db.collection('users').updateMany(
      { role: 'seller', businessType: 'B2B' },
      { $set: { businessType: 'Manufacturer' } }
    );
    console.log("Migrated B2B to Manufacturer:", resB2B.modifiedCount);

    // 2. Migrate B2C to Supplier
    const resB2C = await db.collection('users').updateMany(
      { role: 'seller', businessType: 'B2C' },
      { $set: { businessType: 'Supplier' } }
    );
    console.log("Migrated B2C to Supplier:", resB2C.modifiedCount);

    // 3. For any sellers without businessType, set default as Both or keep as is? Let's keep as is or set Both
    const resNull = await db.collection('users').updateMany(
      { role: 'seller', businessType: { $exists: false } },
      { $set: { businessType: 'Both' } }
    );
    console.log("Set missing businessType to Both for:", resNull.modifiedCount);

    process.exit(0);
  })
  .catch(err => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
