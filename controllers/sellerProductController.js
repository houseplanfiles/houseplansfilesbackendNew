const asyncHandler = require("express-async-handler");
const SellerProduct = require("../models/sellerProductModel.js");
const Brand = require("../models/brandModel.js");
const Category = require("../models/categoryModel.js");

const findOrCreate = async (model, name) => {
  if (!name) return;
  const trimmedName = name.toString().trim();
  const doc = await model.findOne({
    name: { $regex: new RegExp(`^${trimmedName}$`, "i") },
  });
  if (!doc) {
    try {
      await model.create({ name: trimmedName });
    } catch (err) {
      // Handle concurrent creation race condition
      if (err.code !== 11000) throw err;
    }
  }
};

const createSellerProduct = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    brand,
    category,
    price,
    salePrice,
    countInStock,
    city,
    unit,
    youtubeLink,
    seoTitle,
    seoDescription,
    seoAltText,
  } = req.body;

  if (
    !name ||
    !brand ||
    !category ||
    !price ||
    countInStock === undefined ||
    !city
  ) {
    res.status(400);
    throw new Error("Please fill all required fields, including city");
  }

  if (!req.files || !req.files.image || req.files.image.length === 0) {
    res.status(400);
    throw new Error("Main product image is required.");
  }

  const mainImageUrl = req.files.image[0].location;
  const galleryImageUrls = req.files.images
    ? req.files.images.map((file) => file.location)
    : [];

  await findOrCreate(Brand, brand);
  await findOrCreate(Category, category);

  const product = new SellerProduct({
    seller: req.user._id,
    name,
    description,
    brand,
    category,
    price,
    salePrice: salePrice || 0,
    countInStock,
    image: mainImageUrl,
    images: galleryImageUrls,
    city,
    unit: unit || "nos",
    youtubeLink,
    seoTitle,
    seoDescription,
    seoAltText,
    status: "Approved",
    isApproved: true,
  });

  const createdProduct = await product.save();
  res.status(201).json(createdProduct);
});

const getMyProducts = asyncHandler(async (req, res) => {
  const products = await SellerProduct.find({ seller: req.user._id }).sort({
    createdAt: -1,
  });
  res.json(products);
});

const updateMyProduct = asyncHandler(async (req, res) => {
  const product = await SellerProduct.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  if (
    product.seller.toString() !== req.user._id.toString() &&
    req.user.role !== "admin"
  ) {
    res.status(401);
    throw new Error("Not authorized to update this product.");
  }

  const {
    name,
    description,
    brand,
    category,
    price,
    salePrice,
    countInStock,
    city,
    unit,
    youtubeLink,
    seoTitle,
    seoDescription,
    seoAltText,
  } = req.body;

  product.name = name || product.name;
  product.description = description || product.description;
  product.brand = brand || product.brand;
  product.category = category || product.category;
  product.price = price !== undefined ? price : product.price;
  product.salePrice = salePrice !== undefined ? salePrice : product.salePrice;
  product.countInStock =
    countInStock !== undefined ? countInStock : product.countInStock;
  product.city = city || product.city;
  product.unit = unit || product.unit;
  product.youtubeLink = youtubeLink !== undefined ? youtubeLink : product.youtubeLink;
  product.seoTitle = seoTitle !== undefined ? seoTitle : product.seoTitle;
  product.seoDescription = seoDescription !== undefined ? seoDescription : product.seoDescription;
  product.seoAltText = seoAltText !== undefined ? seoAltText : product.seoAltText;

  if (req.files) {
    if (req.files.image && req.files.image.length > 0) {
      product.image = req.files.image[0].location;
    }
    if (req.files.images && req.files.images.length > 0) {
      product.images = req.files.images.map((file) => file.location);
    }
  }

  const updatedProduct = await product.save();
  res.json(updatedProduct);
});

const deleteMyProduct = asyncHandler(async (req, res) => {
  const product = await SellerProduct.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  if (
    product.seller.toString() !== req.user._id.toString() &&
    req.user.role !== "admin"
  ) {
    res.status(401);
    throw new Error("Not authorized to delete this product.");
  }

  await SellerProduct.deleteOne({ _id: req.params.id });
  res.json({ message: "Product removed successfully." });
});

const getUniqueBrands = asyncHandler(async (req, res) => {
  const brands = await Brand.find({}).sort({ name: 1 });
  res.json(brands);
});

const getUniqueCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({}).sort({ name: 1 });
  res.json(categories);
});

const getAllPublicProducts = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 12;
  const page = parseInt(req.query.page, 10) || 1;
  const { city } = req.query;

  let filter = { isApproved: true };
  if (city) {
    filter.city = { $regex: new RegExp(`^${city}$`, "i") };
  }

  const count = await SellerProduct.countDocuments(filter);
  const products = await SellerProduct.find(filter)
    .populate("seller", "businessName photoUrl contractorType role phone charges workSamples updatedAt businessAddress address city pincode businessType materialType")
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(limit * (page - 1));

  res.json({
    products,
    page,
    pages: Math.ceil(count / limit),
    totalProducts: count,
  });
});

const getAllProductsForAdmin = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  let filter = {};
  if (req.query.city) {
    filter.city = { $regex: req.query.city, $options: "i" };
  }

  const products = await SellerProduct.find(filter)
    .populate("seller", "businessName email")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const totalProducts = await SellerProduct.countDocuments(filter);

  res.json({
    products,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalProducts / limit),
      totalProducts,
    },
  });
});

const getPublicProductById = asyncHandler(async (req, res) => {
  const product = await SellerProduct.findById(req.params.id)
    .populate("seller", "businessName photoUrl city contractorType role phone charges workSamples updatedAt businessAddress address pincode businessType materialType");

  if (product && product.isApproved) {
    res.json(product);
  } else {
    res.status(404);
    throw new Error("Product not found");
  }
});

const getPublicProductsBySeller = asyncHandler(async (req, res) => {
  const products = await SellerProduct.find({
    seller: req.params.sellerId,
    isApproved: true,
  }).populate("seller", "businessName photoUrl city contractorType role phone charges workSamples updatedAt businessAddress address pincode businessType materialType");

  res.json(products);
});

module.exports = {
  createSellerProduct,
  getMyProducts,
  updateMyProduct,
  deleteMyProduct,
  getUniqueBrands,
  getUniqueCategories,
  getAllPublicProducts,
  getAllProductsForAdmin,
  getPublicProductsBySeller,
  getPublicProductById,
};
