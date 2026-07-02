const express = require("express");
const router = express.Router();
const Product = require("../models/productModel");
const BlogPost = require("../models/blogPostModel");

// ============================================
// PRODUCT/PLAN SHARE HTML GENERATOR
// ============================================
const generateShareHTML = (data) => {
  const { name, description, image, url, price, plotSize } = data;
  const cleanDescription = description
    .replace(/<[^>]*>/g, "")
    .substring(0, 160);

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${name} | House Plan Files</title>
    
    <!-- Primary Meta Tags -->
    <meta name="title" content="${name}">
    <meta name="description" content="${cleanDescription}">
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="product">
    <meta property="og:url" content="${url}">
    <meta property="og:title" content="${name}">
    <meta property="og:description" content="${cleanDescription}">
    <meta property="og:image" content="${image}">
    <meta property="og:image:secure_url" content="${image}">
    <meta property="og:image:type" content="image/jpeg">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="${name} - House Plan Files">
    <meta property="og:site_name" content="House Plan Files">
    ${price ? `<meta property="product:price:amount" content="${price}">` : ""}
    ${price ? `<meta property="product:price:currency" content="INR">` : ""}
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="${url}">
    <meta name="twitter:title" content="${name}">
    <meta name="twitter:description" content="${cleanDescription}">
    <meta name="twitter:image" content="${image}">
    <meta name="twitter:image:alt" content="${name} - House Plan Files">
    
    <!-- WhatsApp -->
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    
    <!-- JavaScript Redirect (Only for Browsers, NOT Bots) -->
    <script>
      const isBot = /bot|crawler|spider|crawling|facebook|twitter|linkedin|whatsapp|telegram|pinterest|facebookexternalhit|twitterbot/i.test(navigator.userAgent);
      
      if (!isBot) {
        setTimeout(() => {
          window.location.href = "${url}";
        }, 500);
      }
    </script>
    
    <style>
      body { 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        display: flex; 
        justify-content: center; 
        align-items: center; 
        min-height: 100vh; 
        margin: 0; 
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
        color: white;
        padding: 20px;
      }
      .content { 
        text-align: center; 
        max-width: 700px;
        background: rgba(255,255,255,0.1);
        padding: 40px;
        border-radius: 20px;
        backdrop-filter: blur(10px);
      }
      .product-image {
        width: 100%;
        max-width: 600px;
        height: 350px;
        object-fit: cover;
        border-radius: 12px;
        margin: 20px auto;
        display: block;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      }
      h1 { 
        margin: 0 0 16px 0; 
        font-size: 32px;
        font-weight: 700;
        line-height: 1.3;
      }
      .details {
        display: flex;
        justify-content: center;
        gap: 20px;
        margin: 20px 0;
        font-size: 14px;
      }
      .detail-item {
        background: rgba(255,255,255,0.2);
        padding: 8px 16px;
        border-radius: 8px;
      }
      p { 
        font-size: 16px; 
        opacity: 0.9; 
        line-height: 1.6;
        margin: 16px 0;
      }
      .price {
        font-size: 36px;
        font-weight: 800;
        color: #ffd700;
        margin: 20px 0;
      }
      .spinner { 
        border: 4px solid rgba(255,255,255,0.3); 
        border-radius: 50%; 
        border-top: 4px solid white; 
        width: 50px; 
        height: 50px; 
        animation: spin 1s linear infinite; 
        margin: 20px auto; 
      }
      @keyframes spin { 
        0% { transform: rotate(0deg); } 
        100% { transform: rotate(360deg); } 
      }
      a { 
        color: #ffd700; 
        text-decoration: none;
        font-weight: 600;
        padding: 12px 32px;
        background: rgba(255,255,255,0.2);
        border-radius: 8px;
        display: inline-block;
        margin-top: 20px;
        transition: all 0.3s;
      }
      a:hover {
        background: rgba(255,255,255,0.3);
        transform: translateY(-2px);
      }
    </style>
</head>
<body>
    <div class="content">
      <h1>${name}</h1>
      <img src="${image}" alt="${name}" class="product-image" onerror="this.style.display='none'">
      ${plotSize ? `<div class="details"><div class="detail-item">📐 Plot Size: ${plotSize}</div></div>` : ""}
      <p>${cleanDescription}</p>
      ${price ? `<div class="price">₹${Number(price).toLocaleString("en-IN")}</div>` : ""}
      <div class="spinner"></div>
      <p style="font-size: 14px; margin-top: 30px;">Redirecting to House Plan Files...</p>
      <a href="${url}">Click here if not redirected automatically</a>
    </div>
</body>
</html>`;
};

// ============================================
// BLOG SHARE HTML GENERATOR
// ============================================
const generateBlogShareHTML = (data) => {
  const { title, description, image, url, author, tags } = data;
  const cleanDescription = description
    .replace(/<[^>]*>/g, "")
    .substring(0, 160);

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} | House Plan Files Blog</title>
    
    <!-- Primary Meta Tags -->
    <meta name="title" content="${title}">
    <meta name="description" content="${cleanDescription}">
    <meta name="author" content="${author}">
    ${tags ? `<meta name="keywords" content="${tags}">` : ""}
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="article">
    <meta property="og:url" content="${url}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${cleanDescription}">
    <meta property="og:image" content="${image}">
    <meta property="og:image:secure_url" content="${image}">
    <meta property="og:image:type" content="image/jpeg">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="${title} - House Plan Files Blog">
    <meta property="og:site_name" content="House Plan Files">
    <meta property="article:author" content="${author}">
    ${tags ? `<meta property="article:tag" content="${tags}">` : ""}
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="${url}">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${cleanDescription}">
    <meta name="twitter:image" content="${image}">
    <meta name="twitter:image:alt" content="${title} - House Plan Files Blog">
    <meta name="twitter:creator" content="${author}">
    
    <!-- JavaScript Redirect (Only for Browsers, NOT Bots) -->
    <script>
      const isBot = /bot|crawler|spider|crawling|facebook|twitter|linkedin|whatsapp|telegram|pinterest|facebookexternalhit|twitterbot/i.test(navigator.userAgent);
      
      if (!isBot) {
        setTimeout(() => {
          window.location.href = "${url}";
        }, 500);
      }
    </script>
    
    <style>
      body { 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        display: flex; 
        justify-content: center; 
        align-items: center; 
        min-height: 100vh; 
        margin: 0; 
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
        color: white;
        padding: 20px;
      }
      .content { 
        text-align: center; 
        max-width: 700px;
        background: rgba(255,255,255,0.1);
        padding: 40px;
        border-radius: 20px;
        backdrop-filter: blur(10px);
      }
      .blog-image {
        width: 100%;
        max-width: 600px;
        height: 300px;
        object-fit: cover;
        border-radius: 12px;
        margin: 20px auto;
        display: block;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      }
      h1 { 
        margin: 0 0 16px 0; 
        font-size: 32px;
        font-weight: 700;
        line-height: 1.3;
      }
      .author {
        font-size: 14px;
        opacity: 0.9;
        margin: 10px 0;
        font-style: italic;
      }
      p { 
        font-size: 16px; 
        opacity: 0.9; 
        line-height: 1.6;
        margin: 16px 0;
      }
      .spinner { 
        border: 4px solid rgba(255,255,255,0.3); 
        border-radius: 50%; 
        border-top: 4px solid white; 
        width: 50px; 
        height: 50px; 
        animation: spin 1s linear infinite; 
        margin: 20px auto; 
      }
      @keyframes spin { 
        0% { transform: rotate(0deg); } 
        100% { transform: rotate(360deg); } 
      }
      a { 
        color: #ffd700; 
        text-decoration: none;
        font-weight: 600;
        padding: 12px 32px;
        background: rgba(255,255,255,0.2);
        border-radius: 8px;
        display: inline-block;
        margin-top: 20px;
        transition: all 0.3s;
      }
      a:hover {
        background: rgba(255,255,255,0.3);
        transform: translateY(-2px);
      }
    </style>
</head>
<body>
    <div class="content">
      <h1>${title}</h1>
      ${author ? `<div class="author">By ${author}</div>` : ""}
      <img src="${image}" alt="${title}" class="blog-image" onerror="this.style.display='none'">
      <p>${cleanDescription}</p>
      <div class="spinner"></div>
      <p style="font-size: 14px; margin-top: 30px;">Redirecting to House Plan Files Blog...</p>
      <a href="${url}">Click here if not redirected automatically</a>
    </div>
</body>
</html>`;
};

// ============================================
// HELPER: GET ABSOLUTE IMAGE URL
// ============================================
const getAbsoluteImageUrl = (
  dbImage,
  backendUrl,
  defaultImage = "default-house.jpg"
) => {
  if (!dbImage) {
    return `${backendUrl}/uploads/${defaultImage}`;
  }

  if (dbImage.startsWith("http://") || dbImage.startsWith("https://")) {
    return dbImage.replace(/^http:/, "https:");
  }

  const cleanPath = dbImage.startsWith("/") ? dbImage : `/${dbImage}`;
  return `${backendUrl}${cleanPath}`.replace(/^http:/, "https:");
};

// ============================================
// PRODUCT SHARE ROUTE HANDLER
// ============================================
const handleProductShareRequest = async (req, res, type) => {
  const { slug } = req.params;
  const id = slug.split("-").pop();

  const frontendUrl =
    process.env.FRONTEND_URL || "https://www.houseplanfiles.com";
  const productUrl = `${frontendUrl}/${type}/${slug}`;
  const backendUrl =
    process.env.BACKEND_URL || "https://houseplansfiles-backend.vercel.app";

  try {
    const item = await Product.findById(id);

    if (!item) {
      console.log(`⚠️ Product not found: ${id}`);
      return res.redirect(productUrl);
    }

    const itemName = item.name || item.Name || "House Plan";
    const itemDescription =
      item.description ||
      item.Description ||
      "Find and purchase architectural house plans for your dream home.";
    const itemPrice = item.salePrice || item.price || 0;
    const itemPlotSize = item.plotSize || item["Attribute 1 value(s)"] || "";

    // Get main image with fallback logic
    const dbImage =
      item.mainImage ||
      (item.Images ? item.Images.split(",")[0].trim() : null) ||
      (item.galleryImages && item.galleryImages[0]);

    const absoluteImageUrl = getAbsoluteImageUrl(dbImage, backendUrl);

    console.log(`✅ Product share page generated for: ${itemName}`);
    console.log(`📸 Image URL: ${absoluteImageUrl}`);
    console.log(`📝 Type: ${type}`);

    const html = generateShareHTML({
      name: itemName,
      description: itemDescription,
      image: absoluteImageUrl,
      url: productUrl,
      price: itemPrice,
      plotSize: itemPlotSize,
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("X-Robots-Tag", "noindex, follow");
    res.status(200).send(html);
  } catch (error) {
    console.error(`❌ Product share route error for ${slug}:`, error.message);
    res.redirect(productUrl);
  }
};

// ============================================
// BLOG SHARE ROUTE HANDLER
// ============================================
const handleBlogShareRequest = async (req, res) => {
  const { slug } = req.params;

  const frontendUrl =
    process.env.FRONTEND_URL || "https://www.houseplanfiles.com";
  const blogUrl = `${frontendUrl}/blog/${slug}`; // CHANGED: blogs -> blog
  const backendUrl =
    process.env.BACKEND_URL || "https://houseplansfiles-backend.vercel.app";

  try {
    console.log(`🔍 Looking for blog post with slug: "${slug}"`);

    const post = await BlogPost.findOne({ slug });

    if (!post) {
      console.log(`⚠️ Blog post not found with slug: "${slug}"`);
      console.log(`📊 Redirecting to: ${blogUrl}`);
      return res.redirect(blogUrl);
    }

    const postTitle = post.title || "Blog Post";
    const postDescription =
      post.metaDescription ||
      post.description ||
      "Read this interesting article on House Plan Files.";
    const postAuthor = post.author || "House Plan Files";
    const postTags = Array.isArray(post.tags) ? post.tags.join(", ") : "";

    const absoluteImageUrl = getAbsoluteImageUrl(
      post.mainImage,
      backendUrl,
      "default-blog.jpg"
    );

    console.log(`✅ Blog share page generated for: ${postTitle}`);
    console.log(`📸 Image URL: ${absoluteImageUrl}`);

    const html = generateBlogShareHTML({
      title: postTitle,
      description: postDescription,
      image: absoluteImageUrl,
      url: blogUrl,
      author: postAuthor,
      tags: postTags,
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("X-Robots-Tag", "noindex, follow");
    res.status(200).send(html);
  } catch (error) {
    console.error(`❌ Blog share route error for ${slug}:`, error.message);
    res.redirect(blogUrl);
  }
};

// ============================================
// ROUTES
// ============================================
router.get("/product/:slug", (req, res) =>
  handleProductShareRequest(req, res, "product")
);
router.get("/professional-plan/:slug", (req, res) =>
  handleProductShareRequest(req, res, "professional-plan")
);
router.get("/blog/:slug", handleBlogShareRequest);

module.exports = router;
