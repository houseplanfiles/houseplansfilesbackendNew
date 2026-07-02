const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/houseplan";
mongoose.connect(uri)
  .then(async () => {
    console.log("Connected to MongoDB.");
    const db = mongoose.connection.db;
    const res = await db.collection('users').updateMany(
      { role: 'seller', businessType: { $exists: false } },
      { $set: { businessType: 'Both' } }
    );
    console.log("Update Result:", res);
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
