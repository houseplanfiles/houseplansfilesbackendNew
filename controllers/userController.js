const asyncHandler = require("express-async-handler");
const User = require("../models/userModel.js");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { sendEmail } = require("../utils/mailer.js");

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

const validateRoleFields = (role, body) => {
  const {
    name,
    profession,
    businessName,
    address,
    city,
    materialType,
    companyName,
    experience,
    contractorType,
    gstNumber,
    natureOfBusiness,
    businessAddress,
    businessType,
  } = body;
  switch (role) {
    case "user":
      if (!name) throw new Error("Full Name is required for Users");
      return { name, isApproved: true, status: "Approved" };
    case "professional":
      if (!name || !profession || !city || !experience)
        throw new Error(
          "Full Name, Profession, City, and Experience are required"
        );
      return {
        name,
        profession,
        city,
        experience,
        companyName: companyName || "",
        address: address || "",
        qualification: body.qualification || "",
        skills: Array.isArray(body.skills) ? body.skills : (body.skills?.split(",").map(s => s.trim()) || []),
        charges: body.charges || "",
        contractorType: contractorType || "Normal",
        isApproved: false,
        status: "Pending",
        selectedPlan: body.selectedPlan || null,
        profileCreation: body.profileCreation === "true" || body.profileCreation === true || false,
        profileStoreManagement: body.profileStoreManagement || "None",
      };
    case "seller":
      if (!businessName || !address || !city)
        throw new Error(
          "Business Name, Address, and City are required"
        );
      return {
        name: name || "",
        businessName,
        address,
        city,
        materialType: body.materialType || "",
        category: body.category || "",
        gstNumber,
        natureOfBusiness: Array.isArray(natureOfBusiness) ? natureOfBusiness : natureOfBusiness ? [natureOfBusiness] : [],
        businessAddress,
        pincode: body.pincode,
        businessType: businessType || "Both",
        isApproved: false,
        status: "Pending",
        selectedPlan: body.selectedPlan || null,
        profileCreation: body.profileCreation === "true" || body.profileCreation === true || false,
        profileStoreManagement: body.profileStoreManagement || "None",
      };
    case "Contractor":
      if (!name || !address || (!city && !body.selectedCities) || !experience || !profession)
        throw new Error(
          "Full Name, Address, City, Experience, and Profession are required"
        );
      
      let parsedStates = [];
      let parsedCities = [];
      try {
        parsedStates = body.selectedStates ? JSON.parse(body.selectedStates) : [];
      } catch(e) { parsedStates = []; }
      try {
        parsedCities = body.selectedCities ? JSON.parse(body.selectedCities) : [];
      } catch(e) { parsedCities = []; }

      return {
        name,
        companyName: companyName || "",
        address,
        city: city || "",
        selectedStates: parsedStates,
        selectedCities: parsedCities,
        registrationAmount: body.registrationAmount ? Number(body.registrationAmount) : 0,
        experience,
        profession,
        gstNumber,
        qualification: body.qualification || "",
        skills: Array.isArray(body.skills) ? body.skills : (body.skills?.split(",").map(s => s.trim()) || []),
        charges: body.charges || "",
        isApproved: false,
        status: "Pending",
        selectedPlan: body.selectedPlan || null,
        profileCreation: body.profileCreation === "true" || body.profileCreation === true || false,
        profileStoreManagement: body.profileStoreManagement || "None",
      };
    case "admin":
      if (!name) throw new Error("Full Name is required for Admin");
      return { name, isApproved: true, status: "Approved" };
    default:
      throw new Error("Invalid role specified");
  }
};

const getUserDisplayName = (user) => {
  return user.name || user.businessName || user.companyName;
};

const registerUser = asyncHandler(async (req, res) => {
  const { email, password, phone, role } = req.body;
  if (!email || !password || !phone || !role) {
    res.status(400);
    throw new Error(
      "Please provide all required fields: email, password, phone, and role"
    );
  }
  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error("User with this email already exists");
  }
  let userData = { email, password, phone, role };
  try {
    const roleSpecificData = validateRoleFields(role, req.body);
    userData = { ...userData, ...roleSpecificData };

    // Handle file uploads
    if (req.files) {
      if (req.files.photo) userData.photoUrl = req.files.photo[0].location;
      if (req.files.businessCertification)
        userData.businessCertificationUrl =
          req.files.businessCertification[0].location;
      if (req.files.shopImage)
        userData.shopImageUrl = req.files.shopImage[0].location;
      // --- NEW: Portfolio PDF for professionals ---
      if (req.files.portfolio)
        userData.portfolioUrl = req.files.portfolio[0].location;
    }

    // --- NEW: Add bank details for professionals ---
    if (role === "professional") {
      userData.bankName = req.body.bankName || null; // <--- ADDED: Bank Name
      userData.bankAccountNumber = req.body.bankAccountNumber || null;
      userData.ifscCode = req.body.ifscCode || null;
      userData.upiId = req.body.upiId || null;
    }

    const user = await User.create(userData);
    res.status(201).json({
      _id: user._id,
      email: user.email,
      role: user.role,
      name: getUserDisplayName(user),
      isApproved: user.isApproved,
      status: user.status,
      profileViews: user.profileViews,
      contactClicks: user.contactClicks,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(400);
    throw error;
  }
});
const createUserByAdmin = asyncHandler(async (req, res) => {
  const { email, password, phone, role } = req.body;
  if (!email || !password || !phone || !role) {
    res.status(400);
    throw new Error("Email, password, phone, and role are required.");
  }
  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error("User with this email already exists");
  }
  let userData = { email, password, phone, role };
  try {
    const roleSpecificData = validateRoleFields(role, req.body);
    userData = { ...userData, ...roleSpecificData };
    userData.isApproved = true;
    userData.status = "Approved";

    if (req.files) {
      if (req.files.photo) userData.photoUrl = req.files.photo[0].location;
      if (req.files.businessCertification)
        userData.businessCertificationUrl =
          req.files.businessCertification[0].location;
      if (req.files.shopImage)
        userData.shopImageUrl = req.files.shopImage[0].location;
    }
    const user = await User.create(userData);
    res.status(201).json({
      _id: user._id,
      email: user.email,
      role: user.role,
      name: getUserDisplayName(user),
    });
  } catch (error) {
    res.status(400);
    throw error;
  }
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400);
    throw new Error("Please provide email and password");
  }
  const user = await User.findOne({ email });

  if (user && (await user.matchPassword(password))) {
    if (
      ["professional", "seller", "contractor"].includes(user.role.toLowerCase()) &&
      !user.isApproved
    ) {
      res.status(403);
      throw new Error(
        `Your account is currently in "${user.status}" state. Please wait for admin approval.`
      );
    }

    res.json({
      _id: user._id,
      email: user.email,
      role: user.role,
      name: getUserDisplayName(user),
      isApproved: user.isApproved,
      status: user.status,
      profession: user.profession,
      businessName: user.businessName,
      companyName: user.companyName,
      experience: user.experience,
      city: user.city,
      photoUrl: user.photoUrl,
      contractorType: user.contractorType,
      bankName: user.bankName,
      bankAccountNumber: user.bankAccountNumber,
      ifscCode: user.ifscCode,
      upiId: user.upiId,
      packages: user.packages,
      workSamples: user.workSamples,
      coverPhotoUrl: user.coverPhotoUrl,
      qualification: user.qualification,
      skills: user.skills,
      charges: user.charges,
      profileViews: user.profileViews,
      contactClicks: user.contactClicks,
      token: generateToken(user._id),
    });
  } else {
    res.status(401);
    throw new Error("Invalid email or password");
  }
});

const getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      role,
      status,
      city,
      contractorType
    } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { businessName: { $regex: search, $options: "i" } },
        { companyName: { $regex: search, $options: "i" } },
      ];
    }
    if (role && role !== "all") {
      if (role.includes(",")) {
        query.role = { $in: role.split(",") };
      } else {
        query.role = role;
      }
    }
    if (status && status !== "all") {
      query.status = status;
    }
    if (city) {
      query.city = { $regex: city, $options: "i" };
    }
    if (contractorType && contractorType !== "all") {
      query.contractorType = contractorType;
    }
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber);

    const totalUsers = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        totalUsers,
        totalPages: Math.ceil(totalUsers / limitNumber),
        currentPage: pageNumber,
        hasPrevPage: pageNumber > 1,
        hasNextPage: pageNumber < Math.ceil(totalUsers / limitNumber),
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

const getUserById = asyncHandler(async (req, res) => {
  if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
    res.status(400);
    throw new Error("Invalid user ID format");
  }
  const user = await User.findById(req.params.id).select("-password");
  if (user) {
    res.json(user);
  } else {
    res.status(404);
    throw new Error("User not found");
  }
});

const updateUser = asyncHandler(async (req, res) => {
  if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
    res.status(400);
    throw new Error("Invalid user ID format");
  }
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  if (
    req.user.role !== "admin" &&
    user._id.toString() !== req.user._id.toString()
  ) {
    res.status(403);
    throw new Error("Not authorized to update this user's profile.");
  }

  user.email = req.body.email || user.email;
  user.phone = req.body.phone || user.phone;

  if (req.body.password) {
    if (req.body.password.length < 6) {
      res.status(400);
      throw new Error("Password must be at least 6 characters long");
    }
    user.password = req.body.password;
  }

  // Handle file uploads
  if (req.files) {
    if (req.files.photo) user.photoUrl = req.files.photo[0].location;
    if (req.files.shopImage)
      user.shopImageUrl = req.files.shopImage[0].location;
    if (req.files.businessCertification)
      user.businessCertificationUrl =
        req.files.businessCertification[0].location;
    if (req.files.portfolio)
      user.portfolioUrl = req.files.portfolio[0].location;
    if (req.files.coverPhoto)
      user.coverPhotoUrl = req.files.coverPhoto[0].location;
  }

  // Handle packages and work samples (parsed from JSON if needed)
  if (req.body.packages) {
    try {
      const parsedPackages = typeof req.body.packages === "string"
        ? JSON.parse(req.body.packages)
        : req.body.packages;

      // Map PDFs from req.files to individual packages
      if (req.files) {
        parsedPackages.forEach((pkg, index) => {
          const fieldName = `package_pdf_${index}`;
          if (req.files[fieldName]) {
            pkg.pdfUrl = req.files[fieldName][0].location;
          }
        });
      }
      user.packages = parsedPackages;
    } catch (e) {
      console.error("Error parsing packages:", e);
      user.packages = req.body.packages;
    }
  }

  if (req.body.workSamples) {
    try {
      const parsedSamples = typeof req.body.workSamples === "string"
        ? JSON.parse(req.body.workSamples)
        : req.body.workSamples;

      // Map images from req.files to individual samples
      if (req.files) {
        parsedSamples.forEach((sample, index) => {
          const fieldName = `workSample_images_${index}`;
          if (req.files[fieldName]) {
            const uploadedUrls = req.files[fieldName].map(f => f.location);
            // If the sample already has some images, we might want to append or replace
            // For now, let's set 'images' to the new uploads and 'imageUrl' to the first one
            sample.images = uploadedUrls;
            sample.imageUrl = uploadedUrls[0];
          }

          // If features is a comma-separated string, convert to array
          if (sample.features && typeof sample.features === "string") {
            sample.features = sample.features.split(",").map(f => f.trim()).filter(f => f);
          }
        });
      }
      user.workSamples = parsedSamples;
    } catch (e) {
      console.error("Error parsing workSamples:", e);
      user.workSamples = req.body.workSamples;
    }
  }

  const userRole = user.role.toLowerCase();
  switch (userRole) {
    case "user":
    case "admin":
      user.name = req.body.name || user.name;
      break;
    case "professional":
      user.name = req.body.name || user.name;
      user.profession = req.body.profession || user.profession;
      user.city = req.body.city || user.city;
      user.experience = req.body.experience || user.experience;
      user.companyName = req.body.companyName || user.companyName;
      user.address = req.body.address || user.address;
      user.qualification = req.body.qualification || user.qualification;
      user.charges = req.body.charges || user.charges;
      if (req.body.skills) {
        user.skills = Array.isArray(req.body.skills)
          ? req.body.skills
          : req.body.skills.split(",").map(s => s.trim());
      }
      // Admin can set Normal / Verified / Premium
      if (req.body.contractorType) {
        user.contractorType = req.body.contractorType;
      }
      if (req.body.premiumExpiresAt !== undefined) {
        user.premiumExpiresAt = req.body.premiumExpiresAt;
      }
      // Bank details
      user.bankName = req.body.bankName || user.bankName;
      user.bankAccountNumber = req.body.bankAccountNumber || user.bankAccountNumber;
      user.ifscCode = req.body.ifscCode || user.ifscCode;
      user.upiId = req.body.upiId || user.upiId;
      // SEO Fields for Professional/Architect Profile
      if (req.body.seoTitle !== undefined) user.seoTitle = req.body.seoTitle;
      if (req.body.seoDescription !== undefined) user.seoDescription = req.body.seoDescription;
      if (req.body.seoKeywords !== undefined) user.seoKeywords = req.body.seoKeywords;
      break;
    case "seller":
      user.name = req.body.name || user.name;
      user.businessName = req.body.businessName || user.businessName;
      user.address = req.body.address || user.address;
      user.city = req.body.city || user.city;
      user.materialType = req.body.materialType || user.materialType;
      user.category = req.body.category || user.category;
      user.businessType = req.body.businessType || user.businessType;
      user.gstNumber = req.body.gstNumber || user.gstNumber;
      user.businessAddress = req.body.businessAddress || user.businessAddress;
      user.pincode = req.body.pincode || user.pincode;
      if (req.body.natureOfBusiness) {
        user.natureOfBusiness = Array.isArray(req.body.natureOfBusiness)
          ? req.body.natureOfBusiness
          : [req.body.natureOfBusiness];
      }
      if (req.body.contractorType) {
        user.contractorType = req.body.contractorType;
      }
      if (req.body.premiumExpiresAt !== undefined) {
        user.premiumExpiresAt = req.body.premiumExpiresAt;
      }
      // SEO Fields for Seller Store
      if (req.body.seoTitle !== undefined) user.seoTitle = req.body.seoTitle;
      if (req.body.seoDescription !== undefined) user.seoDescription = req.body.seoDescription;
      if (req.body.seoKeywords !== undefined) user.seoKeywords = req.body.seoKeywords;
      break;
    case "contractor":
    case "architect":
      user.name = req.body.name || user.name;
      user.companyName = req.body.companyName || user.companyName;
      user.experience = req.body.experience || user.experience;
      user.city = req.body.city || user.city;
      user.address = req.body.address || user.address;
      user.gstNumber = req.body.gstNumber || user.gstNumber;
      user.qualification = req.body.qualification || user.qualification;
      user.charges = req.body.charges || user.charges;
      if (req.body.skills) {
        user.skills = Array.isArray(req.body.skills)
          ? req.body.skills
          : req.body.skills.split(",").map(s => s.trim());
      }

      // Premium fields for administrators or manual updates
      if (req.body.contractorType) {
        user.contractorType = req.body.contractorType;
      }

      if (req.body.premiumExpiresAt !== undefined) {
        user.premiumExpiresAt = req.body.premiumExpiresAt;
      }
      user.profession = req.body.profession || user.profession;
      // SEO Fields for Contractor/Architect Profile
      if (req.body.seoTitle !== undefined) user.seoTitle = req.body.seoTitle;
      if (req.body.seoDescription !== undefined) user.seoDescription = req.body.seoDescription;
      if (req.body.seoKeywords !== undefined) user.seoKeywords = req.body.seoKeywords;
      break;
  }

  if (req.user.role === "admin") {
    if (req.body.status) {
      user.status = req.body.status;
      user.isApproved = req.body.status === "Approved";
    } else if (req.body.isApproved !== undefined) {
      user.isApproved = req.body.isApproved;
      user.status = req.body.isApproved ? "Approved" : "Pending";
    }
    if (req.body.selectedPlan !== undefined) {
      user.selectedPlan = req.body.selectedPlan;
    }
    if (req.body.profileCreation !== undefined) {
      user.profileCreation = req.body.profileCreation === "true" || req.body.profileCreation === true;
    }
    if (req.body.profileStoreManagement !== undefined) {
      user.profileStoreManagement = req.body.profileStoreManagement;
    }
    if (req.body.paymentStatus !== undefined) {
      user.paymentStatus = req.body.paymentStatus;
    }
  }

  const updatedUser = await user.save();

  res.json({
    _id: updatedUser._id,
    name: getUserDisplayName(updatedUser),
    email: updatedUser.email,
    phone: updatedUser.phone,
    role: updatedUser.role,
    isApproved: updatedUser.isApproved,
    status: updatedUser.status,
    businessName: updatedUser.businessName,
    companyName: updatedUser.companyName,
    profession: updatedUser.profession,
    experience: updatedUser.experience,
    address: updatedUser.address,
    city: updatedUser.city,
    pincode: updatedUser.pincode,
    materialType: updatedUser.materialType,
    photoUrl: updatedUser.photoUrl,
    shopImageUrl: updatedUser.shopImageUrl,
    businessCertificationUrl: updatedUser.businessCertificationUrl,
    portfolioUrl: updatedUser.portfolioUrl,
    bankName: updatedUser.bankName, // <--- ADDED to Response
    bankAccountNumber: updatedUser.bankAccountNumber,
    ifscCode: updatedUser.ifscCode,
    upiId: updatedUser.upiId,
    contractorType: updatedUser.contractorType,
    selectedPlan: updatedUser.selectedPlan,
    profileCreation: updatedUser.profileCreation,
    profileStoreManagement: updatedUser.profileStoreManagement,
    paymentStatus: updatedUser.paymentStatus,
    coverPhotoUrl: updatedUser.coverPhotoUrl,
    packages: updatedUser.packages,
    workSamples: updatedUser.workSamples,
    qualification: updatedUser.qualification,
    skills: updatedUser.skills,
    charges: updatedUser.charges,
    token: generateToken(updatedUser._id),
  });
});

const deleteUser = asyncHandler(async (req, res) => {
  if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
    res.status(400);
    throw new Error("Invalid user ID format");
  }
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }
  if (user.role === "admin") {
    res.status(400);
    throw new Error("Cannot delete an admin user");
  }
  await User.findByIdAndDelete(req.params.id);
  res.json({
    message: "User removed successfully",
    deletedUser: {
      _id: user._id,
      name: getUserDisplayName(user),
      email: user.email,
      role: user.role,
    },
  });
});

const SellerProduct = require("../models/sellerProductModel.js");

const getUserStats = asyncHandler(async (req, res) => {
  const stats = await User.aggregate([
    { $match: { role: { $ne: "admin" } } },
    {
      $group: {
        _id: "$role",
        count: { $sum: 1 },
        approved: { $sum: { $cond: [{ $eq: ["$isApproved", true] }, 1, 0] } },
        pending: { $sum: { $cond: [{ $eq: ["$status", "Pending"] }, 1, 0] } },
      },
    },
  ]);

  // Aggregate contractor & architect project count (workSamples)
  const contractorStats = await User.aggregate([
    { $match: { role: { $regex: /^(contractor|architect)$/i } } },
    {
      $group: {
        _id: null,
        totalProjects: { $sum: { $size: { $ifNull: ["$workSamples", []] } } }
      }
    }
  ]);

  const totalSellerProducts = await SellerProduct.countDocuments();
  const totalUsers = await User.countDocuments({ role: "user" });
  const totalProfessionals = await User.countDocuments({ role: "professional" });
  const totalContractors = await User.countDocuments({ role: { $regex: /^(contractor|architect)$/i } });
  const totalSellers = await User.countDocuments({ role: "seller" });

  res.json({
    totalUsers,
    totalProfessionals,
    totalContractors,
    totalSellers,
    totalContractorProjects: contractorStats[0]?.totalProjects || 0,
    totalSellerProducts,
    breakdown: stats
  });
});

// @desc    Get all contractor projects for admin
// @route   GET /api/users/admin/contractor-projects
// @access  Private/Admin
const getAllContractorProjects = asyncHandler(async (req, res) => {
  // Case-insensitive role check for contractors and architects
  const contractors = await User.find({
    role: { $regex: /^(contractor|architect)$/i }
  }).select("name workSamples");

  console.log(`Debug: Found ${contractors.length} contractors for projects list.`);

  let allProjects = [];
  contractors.forEach(contractor => {
    if (contractor.workSamples && contractor.workSamples.length > 0) {
      contractor.workSamples.forEach((sample, sampleIdx) => {
        const projectObj = sample.toObject ? sample.toObject() : sample;
        allProjects.push({
          ...projectObj,
          contractorId: contractor._id,
          contractorName: contractor.name,
          projectIndex: sampleIdx
        });
      });
    }
  });

  console.log(`Debug: Total projects gathered: ${allProjects.length}`);
  res.json(allProjects);
});

const getContractorPublicProfile = asyncHandler(async (req, res) => {
  const contractor = await User.findById(req.params.id).select(
    "name companyName photoUrl shopImageUrl city address experience profession contractorType coverPhotoUrl packages workSamples portfolioUrl role"
  );

  if (contractor && contractor.role && ["contractor", "architect", "professional"].includes(contractor.role.toLowerCase())) {
    res.json(contractor);
  } else {
    console.log("Contractor/Professional profile search failed for ID:", req.params.id, "Found:", !!contractor, "Role:", contractor?.role);
    res.status(404);
    throw new Error("Professional not found or user is not a registered professional");
  }
});

const getSellerPublicProfile = asyncHandler(async (req, res) => {
  const seller = await User.findById(req.params.sellerId).select(
    "name businessName shopImageUrl photoUrl city address materialType role businessType"
  );

  if (seller && seller.role === "seller") {
    res.json(seller);
  } else {
    res.status(404);
    throw new Error("Seller not found");
  }
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  if (!user) {
    return res.json({
      message: "Password reset link has been sent to your email.",
    });
  }

  const resetToken = crypto.randomBytes(32).toString("hex");

  user.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  user.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  await user.save({ validateBeforeSave: false });

  try {
    const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    const message = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Request</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f4f4f4;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); border-radius: 8px; overflow: hidden;">
                <tr>
                  <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                      🏠 HousePlansFiles
                    </h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 30px;">
                    <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 24px; font-weight: 600;">
                      Password Reset Request
                    </h2>
                    <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                      Hello <strong>${user.name || "User"}</strong>,
                    </p>
                    <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                      We received a request to reset your password for your HousePlansFiles account. Click the button below to create a new password:
                    </p>
                    <table role="presentation" style="margin: 30px 0;">
                      <tr>
                        <td align="center">
                          <a href="${resetURL}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 6px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.4);">
                            Reset Password
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 20px 0; color: #666666; font-size: 14px; line-height: 1.6;">
                      Or copy and paste this link into your browser:
                    </p>
                    <p style="margin: 0 0 20px 0; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #667eea; color: #667eea; font-size: 14px; word-break: break-all; border-radius: 4px;">
                      ${resetURL}
                    </p>
                    <div style="margin: 30px 0; padding: 20px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
                      <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.6;">
                        ⚠️ <strong>Important:</strong> This link will expire in <strong>10 minutes</strong> for security reasons.
                      </p>
                    </div>
                    <p style="margin: 20px 0 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
                      If you didn't request a password reset, please ignore this email or contact support if you have concerns.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
                    <p style="margin: 0 0 10px 0; color: #999999; font-size: 14px;">
                      Best regards,<br>
                      <strong>The HousePlansFiles Team</strong>
                    </p>
                    <p style="margin: 10px 0 0 0; color: #999999; font-size: 12px;">
                      © ${new Date().getFullYear()} HousePlansFiles. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    await sendEmail({
      to: user.email,
      subject: "🔐 HousePlansFiles - Password Reset Request",
      html: message,
    });

    res.json({ message: "Password reset link has been sent to your email." });
  } catch (error) {
    console.error("DETAILED NODEMAILER ERROR:", error);

    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    res.status(500);
    throw new Error("Email could not be sent. Please try again later.");
  }
});

const addProjectReview = asyncHandler(async (req, res) => {
  const { rating, comment, projectIdx } = req.body;
  const user = await User.findById(req.params.id);

  if (user) {
    const project = user.workSamples[Number(projectIdx)];
    if (!project) {
      res.status(404);
      throw new Error("Project not found");
    }

    const review = {
      name: req.user.name,
      rating: Number(rating),
      comment,
      user: req.user._id,
    };

    project.reviews.push(review);
    await user.save();
    res.status(201).json({ message: "Review added successfully" });
  } else {
    res.status(404);
    throw new Error("Contractor not found");
  }
});

const resetPassword = asyncHandler(async (req, res) => {
  const { password } = req.body;
  const { token } = req.params;

  if (!password || password.length < 6) {
    res.status(400);
    throw new Error(
      "Password is required and must be at least 6 characters long."
    );
  }

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    res.status(400);
    throw new Error("Token is invalid or has expired.");
  }

  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  await user.save();

  res.json({ message: "Password has been reset successfully. Please login." });
});

const updateProjectSEO = asyncHandler(async (req, res) => {
  const { projectIdx, seo } = req.body;
  const user = await User.findById(req.params.id);

  if (user) {
    const project = user.workSamples[Number(projectIdx)];
    if (!project) {
      res.status(404);
      throw new Error("Project not found");
    }

    project.seo = {
      title: seo.title || "",
      description: seo.description || "",
      keywords: Array.isArray(seo.keywords) ? seo.keywords : (seo.keywords?.split(",").map((k) => k.trim()) || []),
      h1: seo.h1 || "",
      canonicalUrl: seo.canonicalUrl || "",
      customLinks: seo.customLinks || [],
    };

    await user.save();
    res.status(200).json({ message: "SEO updated successfully" });
  } else {
    res.status(404);
    throw new Error("User not found");
  }
});

module.exports = {
  registerUser,
  loginUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUserStats,
  createUserByAdmin,
  getSellerPublicProfile,
  getContractorPublicProfile,
  forgotPassword,
  resetPassword,
  addProjectReview,
  updateProjectSEO,
  getAllContractorProjects,
};
