const mongoose = require("mongoose");

const customizationRequestSchema = mongoose.Schema(
  {
    countryName: {
      type: String,
      required: [true, "Country name is required."],
      trim: true,
    },
    requestType: {
      type: String,
      required: true,
      enum: [
        "Floor Plan Customization",
        "3D Elevation",
        "Interior Design",
        "3D Video Walkthrough",
      ],
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    whatsappNumber: {
      type: String,
      required: true,
    },
    width: { type: String },
    length: { type: String },
    roomWidth: { type: String },
    roomLength: { type: String },
    facingDirection: { type: String },
    planForFloor: { type: String },
    elevationType: { type: String, enum: ["Front", "Corner"] },
    designFor: { type: String },
    description: { type: String },
    referenceFileUrl: { type: String },
    status: {
      type: String,
      enum: ["Pending", "Contacted", "In Progress", "Completed", "Cancelled"],
      default: "Pending",
    },
    adminNotes: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

const CustomizationRequest =
  mongoose.models.CustomizationRequest ||
  mongoose.model("CustomizationRequest", customizationRequestSchema);

module.exports = CustomizationRequest;
