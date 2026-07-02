const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");


const userRoutes = require("./routes/userRoutes");
const productRoutes = require("./routes/productRoutes");
const professionalPlanRoutes = require("./routes/professionalPlanRoutes");
const customizationRequestRoutes = require("./routes/customizationRequestRoutes");
const standardRequestRoutes = require("./routes/standardRequestRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
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
const startPremiumExpiryCron = require("./crons/premiumExpiry");
dotenv.config();
connectDB();

// Start cron jobs
startPremiumExpiryCron();

const app = express();

// --- SECURITY & BOT PREVENTION ---

// 1. Trust proxy if behind a load balancer (Vercel/Nginx/Render)
app.set("trust proxy", 1);

// 2. Security Headers
app.use(helmet({
  crossOriginResourcePolicy: false, // Allow cross-origin images if needed
}));

// 3. Global Rate Limiter (Max 300 requests per 15 minutes per IP)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 300, 
  message: { message: "Too many requests from this IP, please try again after 15 minutes." },
  standardHeaders: true, 
  legacyHeaders: false,
});
app.use(globalLimiter);

// 4. Block common bad bot User-Agents
app.use((req, res, next) => {
  const ua = req.headers["user-agent"] || "";
  if (!ua) {
    return res.status(403).json({ message: "Access denied: Missing User-Agent." });
  }
  // Block common scrapers/scripts but allow standard SEO bots (Google, Bing)
  const badBotPattern = /python-requests|curl|wget|postmanruntime|urllib|headless|phantomjs/i;
  if (badBotPattern.test(ua)) {
    return res.status(403).json({ message: "Access denied: Automated scripts detected." });
  }
  next();
});

// ✅ CORS FIXED — only this part changed
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);


app.use(express.json());

app.use("/uploads", express.static(path.join(__dirname, "/uploads")));

app.get("/", (req, res) => {
  res.send("API is running...");
});

app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/professional-plans", professionalPlanRoutes);
app.use("/api/customize", customizationRequestRoutes);
app.use("/api/standard-requests", standardRequestRoutes);
app.use("/api/premium-requests", premiumRequestRoutes);
app.use("/api/corporate-inquiries", corporateInquiryRoutes);
app.use("/api/inquiries", inquiryRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/gallery", galleryRoutes);
app.use("/api/videos", videoRoutes);
app.use("/api/packages", packageRoutes);
app.use("/api/professional-orders", professionalOrderRoutes);
app.use("/api/seller/products", sellerProductRoutes);
app.use("/api/sellerinquiries", sellerinquiryRoutes);
app.use("/api/media", mediaRoutes);
app.use("/share", shareRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/feed", feedRoutes);
app.use("/api/seller-dashboard", sellerDashboardRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
