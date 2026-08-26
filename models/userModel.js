const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Notification = require("./notificationModel");

const userSchema = mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String, required: true },
    role: {
      type: String,
      required: true,
      enum: ["user", "professional", "seller", "Contractor", "Architect", "admin"],
    },
    name: { type: String },
    isApproved: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    photoUrl: { type: String },
    profession: { type: String },
    businessCertificationUrl: { type: String },
    shopImageUrl: { type: String },
    city: { type: String },
    selectedStates: [{ type: String }],
    selectedCities: [{ type: String }],
    registrationAmount: { type: Number, default: 0 },
    address: { type: String },
    pincode: { type: String },
    experience: { type: String },
    businessName: { type: String },
    gstNumber: { type: String },
    natureOfBusiness: [{ type: String }],
    businessAddress: { type: String },
    materialType: { type: String },
    companyName: { type: String },
    businessType: { type: String, enum: ["Manufacturer", "Supplier", "Both", "Retail"] },
    category: { type: String },
    contractorType: {
      type: String,
      enum: ["Normal", "Verified", "Premium"],
      default: "Normal",
    },
    premiumExpiresAt: { type: Date, default: null },

    // --- Subscription & Payment Fields ---
    selectedPlan: { 
      type: String, 
      enum: ["Basic", "Standard", "Premium", "Premium+"], 
      default: null 
    },
    profileCreation: { type: Boolean, default: false },
    profileStoreManagement: { 
      type: String, 
      enum: ["None", "6_Month", "1_Year"], 
      default: "None" 
    },
    paymentStatus: { 
      type: String, 
      enum: ["Unpaid", "Paid"], 
      default: "Unpaid" 
    },
    paymentDetails: {
      orderId: { type: String },
      paymentId: { type: String },
      amountPaid: { type: Number },
      gstPaid: { type: Number },
      paidAt: { type: Date }
    },

    // --- NEW: Contractor Detailed Profile (For Premium) ---
    coverPhotoUrl: { type: String },
    packages: [
      {
        name: { type: String },
        price: { type: String },
        description: { type: String },
        pdfUrl: { type: String },
      },
    ],
    workSamples: [
      {
        title: { type: String },
        description: { type: String },
        location: { type: String },
        imageUrl: { type: String },
        images: [{ type: String }],
        features: [{ type: String }],
        reviews: [
          {
            user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            name: { type: String },
            rating: { type: Number, required: true },
            comment: { type: String, required: true },
            createdAt: { type: Date, default: Date.now },
          },
        ],
        seo: {
          title: { type: String, default: "" },
          description: { type: String, default: "" },
          keywords: [{ type: String }],
          h1: { type: String, default: "" },
          canonicalUrl: { type: String, default: "" },
          customLinks: [
            {
              label: { type: String },
              url: { type: String },
            },
          ],
        },
      },
    ],

    // --- NEW: Professional Bank & Payment Details ---
    bankName: { type: String }, // <--- ADDED: Bank Name Field
    bankAccountNumber: { type: String },
    ifscCode: { type: String },
    upiId: { type: String },
    portfolioUrl: { type: String }, // Portfolio PDF URL

    // --- NEW: Architect Specific Fields ---
    qualification: { type: String },
    skills: [{ type: String }],
    serviceTypes: [{ type: String }], // e.g. ["NEW CONSTRUCTION", "RENOVATION"]
    charges: { type: String },

    passwordResetToken: String,
    passwordResetExpires: Date,

    // --- SEO Fields (Seller Store & Professional Profile) ---
    seoTitle: { type: String, default: "" },
    seoDescription: { type: String, default: "" },
    seoKeywords: { type: String, default: "" },

    // --- Analytics Tracking Fields ---
    profileViews: { type: Number, default: 0 },
    contactClicks: { type: Number, default: 0 },
    whatsappClicks: { type: Number, default: 0 },
    callClicks: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.post("save", async function (doc, next) {
  if (this.isNew) {
    try {
      await Notification.create({
        message: `New ${doc.role} registered: ${doc.name || doc.email}`,
        type: "NEW_USER",
        link: "/admin/users",
      });
    } catch (error) {
      console.error("Failed to create notification for new user:", error);
    }
  }
  next();
});

const User = mongoose.model("User", userSchema);

module.exports = User;
