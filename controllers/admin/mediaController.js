const asyncHandler = require("express-async-handler");
const Product = require("../../models/productModel.js");

const getAllProductsForMedia = asyncHandler(async (req, res) => {
  const pageSize = parseInt(req.query.limit) || 20;
  const page = parseInt(req.query.pageNumber) || 1;
  const searchTerm = req.query.searchTerm || "";

  const query = searchTerm
    ? {
        $or: [
          { name: { $regex: searchTerm, $options: "i" } },
          { Name: { $regex: searchTerm, $options: "i" } },
          { productNo: { $regex: searchTerm, $options: "i" } },
          { SKU: { $regex: searchTerm, $options: "i" } },
        ],
      }
    : {};

  const count = await Product.countDocuments(query);

  const products = await Product.find(query)
    .sort({ createdAt: -1 })
    .limit(pageSize)
    .skip(pageSize * (page - 1));

  const formattedProducts = products.map((p) => {
    const doc = p._doc;

    const firstImageFromImagesField =
      doc.Images && typeof doc.Images === "string"
        ? doc.Images.split(",")[0].trim()
        : null;

    const mainImage = doc.mainImage || firstImageFromImagesField;

    let planFile = [];

    if (
      doc.planFile &&
      Array.isArray(doc.planFile) &&
      doc.planFile.length > 0
    ) {
      planFile = doc.planFile;
    } else {
      for (let i = 1; i <= 7; i++) {
        const key = `Download ${i} URL`;
        if (doc[key]) {
          planFile.push(doc[key]);
        }
      }
    }

    return {
      _id: doc._id,
      name: doc.name || doc.Name || "Untitled",
      productNo: doc.productNo || doc.SKU || "N/A",
      planType: doc.planType || "N/A",
      mainImage: mainImage,
      planFile: planFile,
    };
  });

  res.json({
    products: formattedProducts,
    page,
    pages: Math.ceil(count / pageSize),
    count,
  });
});

module.exports = { getAllProductsForMedia };
