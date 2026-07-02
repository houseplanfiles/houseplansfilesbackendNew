const Product = require("../models/productModel");

const escapeXml = (unsafe) => {
    if (!unsafe) return "";
    return unsafe
        .toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
};

const getGoogleFeed = async (req, res) => {
    try {
        // 1. Fetch all published products
        // Selecting only necessary fields to optimize query
        const products = await Product.find({ status: "Published" })
            .select("name description _id salePrice price mainImage productNo status")
            .lean();

        // 2. Start XML construction
        let xml = `<?xml version="1.0"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
<channel>
<title>House Plan Files</title>
<link>https://houseplanfiles.com</link>
<description>Readymade House Plans and Designs</description>
`;

        // 3. Loop and add items
        products.forEach((product) => {
            const link = `https://houseplanfiles.com/product/${product._id}`;
            // Use salePrice if available, otherwise regular price
            const price = product.salePrice > 0 ? product.salePrice : product.price;
            const imageUrl = product.mainImage || "";

            // Ensure we have minimal required fields
            if (price && product.name) {
                xml += `
<item>
<g:id>${escapeXml(product.productNo || product._id)}</g:id>
<g:title>${escapeXml(product.name)}</g:title>
<g:description>${escapeXml(product.description || product.name)}</g:description>
<g:link>${escapeXml(link)}</g:link>
<g:image_link>${escapeXml(imageUrl)}</g:image_link>
<g:brand>House Plan Files</g:brand>
<g:condition>new</g:condition>
<g:availability>in_stock</g:availability>
<g:price>${price} INR</g:price>
</item>`;
            }
        });

        // 4. Close XML
        xml += `
</channel>
</rss>`;

        // 5. Send response with correct header
        res.set("Content-Type", "application/xml");
        res.send(xml);
    } catch (error) {
        console.error("Feed generation error:", error);
        res.status(500).send("Error generating feed");
    }
};

module.exports = { getGoogleFeed };
