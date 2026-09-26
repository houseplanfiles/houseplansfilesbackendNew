const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const connectDB = require("./config/db");

// Routes
const userRoutes = require("./routes/userRoutes");
const productRoutes = require("./routes/productRoutes");
const professionalPlanRoutes = require("./routes/professionalPlanRoutes");
const customizationRequestRoutes = require("./routes/customizationRequestRoutes");
const standardRequestRoutes = require("./routes/standardRequestRoutes");
const premiumRequestRoutes = require("./routes/premiumRequestRoutes");
const corporateInquiryRoutes = require("./routes/corporateInquiryRoutes");
const inquiryRoutes = require("./routes/inquiryRoutes.js");
const cartRoutes = require("./routes/cartRoutes.js");
const orderRoutes = require("./routes/orderRoutes.js");
const adminRoutes = require("./routes/adminRoutes");
const wishlistRoutes = require("./routes/wishlistRoutes.js");
const blogRoutes = require("./routes/blogRoutes.js");
const galleryRoutes = require("./routes/galleryRoutes.js");
const videoRoutes = require("./routes/videoRoutes.js");
const packageRoutes = require("./routes/packageRoutes.js");
const professionalOrderRoutes = require("./routes/professionalOrderRoutes.js");
const sellerProductRoutes = require("./routes/sellerProductRoutes");
const sellerinquiryRoutes = require("./routes/sellerinquiryRoutes.js");
const mediaRoutes = require("./routes/mediaRoutes.js");
const shareRoutes = require("./routes/shareRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const feedRoutes = require("./routes/feed.route");
const sellerDashboardRoutes = require("./routes/sellerDashboardRoutes");
const leadRoutes = require("./routes/leadRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");

// Middleware
const {
  notFound,
  errorHandler,
} = require("./middleware/errorMiddleware");

// Cron
const startPremiumExpiryCron = require("./crons/premiumExpiry");


// ======================================================
// ENVIRONMENT
// ======================================================

dotenv.config();


// ======================================================
// APP
// ======================================================

const app = express();


// ======================================================
// TRUST PROXY
// ======================================================

app.set("trust proxy", 1);


// ======================================================
// CORS
// ======================================================

const allowedOrigins = [
  "https://www.houseplansfiles.com",
  "https://houseplansfiles.com",

  // Local development
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5173",
  "http://localhost:5174",
];


const corsOptions = {
  origin: function (origin, callback) {

    // Allow requests without Origin
    // Example: server-to-server, health checks, etc.
    if (!origin) {
      return callback(null, true);
    }

    // Allow only trusted origins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.log("CORS blocked origin:", origin);

    return callback(
      new Error(`CORS blocked for origin: ${origin}`)
    );
  },

  credentials: true,

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
  ],

  exposedHeaders: [
    "Content-Length",
    "Content-Range",
  ],

  optionsSuccessStatus: 204,
};


// IMPORTANT:
// CORS middleware should come before routes
app.use(cors(corsOptions));


// ======================================================
// SECURITY HEADERS
// ======================================================

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);


// ======================================================
// RATE LIMITER
// ======================================================

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  max: 300,

  standardHeaders: true,

  legacyHeaders: false,

  message: {
    success: false,
    message:
      "Too many requests from this IP, please try again after 15 minutes.",
  },

  // Don't count CORS preflight requests
  skip: (req) => req.method === "OPTIONS",
});

app.use(globalLimiter);


// ======================================================
// BODY PARSER
// ======================================================

app.use(
  express.json({
    limit: "10mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);


// ======================================================
// USER AGENT PROTECTION
// ======================================================

app.use((req, res, next) => {

  const userAgent = req.headers["user-agent"] || "";

  // Don't block requests without user-agent
  // because server/serverless requests may not always contain it.
  if (!userAgent) {
    return next();
  }

  const badBotPattern =
    /python-requests|wget|urllib|headless|phantomjs/i;

  if (badBotPattern.test(userAgent)) {
    return res.status(403).json({
      success: false,
      message: "Access denied: Automated scripts detected.",
    });
  }

  next();
});


// ======================================================
// STATIC FILES
// ======================================================

app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"))
);


// ======================================================
// HEALTH CHECK
// ======================================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "HousePlansFiles API is running...",
    environment: process.env.NODE_ENV || "development",
  });
});


// Health endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is healthy",
    timestamp: new Date().toISOString(),
  });
});


// ======================================================
// API ROUTES
// ======================================================

app.use("/api/users", userRoutes);

app.use("/api/products", productRoutes);

app.use(
  "/api/professional-plans",
  professionalPlanRoutes
);

app.use(
  "/api/customize",
  customizationRequestRoutes
);

app.use(
  "/api/standard-requests",
  standardRequestRoutes
);

app.use(
  "/api/premium-requests",
  premiumRequestRoutes
);

app.use(
  "/api/corporate-inquiries",
  corporateInquiryRoutes
);

app.use(
  "/api/inquiries",
  inquiryRoutes
);

app.use(
  "/api/cart",
  cartRoutes
);

app.use(
  "/api/orders",
  orderRoutes
);

app.use(
  "/api/admin",
  adminRoutes
);

app.use(
  "/api/wishlist",
  wishlistRoutes
);

app.use(
  "/api/blogs",
  blogRoutes
);

app.use(
  "/api/gallery",
  galleryRoutes
);

app.use(
  "/api/videos",
  videoRoutes
);

app.use(
  "/api/packages",
  packageRoutes
);

app.use(
  "/api/professional-orders",
  professionalOrderRoutes
);

app.use(
  "/api/seller/products",
  sellerProductRoutes
);

app.use(
  "/api/sellerinquiries",
  sellerinquiryRoutes
);

app.use(
  "/api/media",
  mediaRoutes
);

app.use(
  "/share",
  shareRoutes
);

app.use(
  "/api/notifications",
  notificationRoutes
);

app.use(
  "/api/feed",
  feedRoutes
);

app.use(
  "/api/seller-dashboard",
  sellerDashboardRoutes
);

app.use(
  "/api/leads",
  leadRoutes
);

app.use(
  "/api/analytics",
  analyticsRoutes
);


// ======================================================
// 404 HANDLER
// ======================================================

app.use(notFound);


// ======================================================
// GLOBAL ERROR HANDLER
// ======================================================

app.use(errorHandler);


// ======================================================
// DATABASE CONNECTION
// ======================================================

connectDB()
  .then(() => {
    console.log("MongoDB connected successfully");
  })
  .catch((error) => {
    console.error(
      "MongoDB connection failed:",
      error
    );
  });


// ======================================================
// CRON JOB
// ======================================================

// Start cron only when explicitly enabled.
// This avoids unnecessary cron instances in Vercel serverless.
if (process.env.ENABLE_CRON === "true") {
  try {
    startPremiumExpiryCron();

    console.log(
      "Premium expiry cron started successfully"
    );
  } catch (error) {
    console.error(
      "Failed to start premium expiry cron:",
      error
    );
  }
}


// ======================================================
// LOCAL SERVER
// ======================================================

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(
      `Server running on port ${PORT}`
    );
  });
}


// ======================================================
// VERCEL EXPORT
// ======================================================

module.exports = app;