const asyncHandler = require("express-async-handler");
const SellerInquiry = require("../models/sellerinquiryModel.js");
const SellerProduct = require("../models/sellerProductModel.js");

const getSellerDashboardData = asyncHandler(async (req, res) => {
  const sellerId = req.user._id;

  const totalProductsPromise = SellerProduct.countDocuments({
    seller: sellerId,
  });

  const totalInquiriesPromise = SellerInquiry.countDocuments({
    seller: sellerId,
  });

  const uniqueBuyersPromise = SellerInquiry.distinct("email", {
    seller: sellerId,
  });

  const recentInquiriesPromise = SellerInquiry.find({ seller: sellerId })
    .populate("product", "name")
    .sort({ createdAt: -1 })
    .limit(5);

  // Group Inquiries by Date for the last 15 days
  const fifteenDaysAgo = new Date();
  fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

  const dailyStatsPromise = SellerInquiry.aggregate([
    {
      $match: {
        seller: sellerId,
        createdAt: { $gte: fifteenDaysAgo },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
        },
        inquiries: { $sum: 1 },
        buyersSet: { $addToSet: "$email" },
      },
    },
    {
      $project: {
        date: "$_id",
        inquiries: 1,
        buyers: { $size: "$buyersSet" },
        _id: 0,
      },
    },
    { $sort: { date: 1 } },
  ]);

  const [totalProducts, totalInquiries, uniqueBuyers, recentInquiries, dailyStats] =
    await Promise.all([
      totalProductsPromise,
      totalInquiriesPromise,
      uniqueBuyersPromise,
      recentInquiriesPromise,
      dailyStatsPromise,
    ]);

  res.json({
    totalProducts,
    totalInquiries,
    totalBuyers: uniqueBuyers.length,
    recentInquiries,
    dailyStats,
  });
});

module.exports = {
  getSellerDashboardData,
};
