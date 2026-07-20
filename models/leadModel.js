const mongoose = require("mongoose");

const leadSchema = mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Lead title is required"],
    },
    category: {
      type: String,
      required: [true, "Lead category is required"],
    },
    city: {
      type: String,
      required: [true, "Lead city/location is required"],
    },
    budget: {
      type: String,
      required: [true, "Lead budget is required"],
    },
    requirements: {
      type: String,
      required: [true, "Lead requirements details are required"],
    },
    price: {
      type: Number,
      required: [true, "Lead unlock price is required"],
      default: 0,
    },
    
    // --- Hidden Client/Contact details ---
    clientName: {
      type: String,
      required: [true, "Client name is required"],
    },
    clientPhone: {
      type: String,
      required: [true, "Client phone/WhatsApp number is required"],
    },
    clientEmail: {
      type: String,
      default: "",
    },

    // --- Purchase/Status tracking ---
    status: {
      type: String,
      enum: ["Available", "Sold"],
      default: "Available",
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    paymentDetails: {
      razorpay_order_id: { type: String, default: "" },
      razorpay_payment_id: { type: String, default: "" },
      razorpay_signature: { type: String, default: "" },
      purchasedAt: { type: Date },
    },
  },
  {
    timestamps: true,
  }
);

const Lead = mongoose.models.Lead || mongoose.model("Lead", leadSchema);

module.exports = Lead;
