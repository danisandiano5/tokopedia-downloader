const express = require("express");
const axios = require("axios");
const cors = require("cors");
const path = require("path");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

/**
 * Resolve shortlink Tokopedia (vt.tokopedia.com)
 */
async function resolveShortlink(url) {
  try {
    const response = await axios.get(url, {
      maxRedirects: 5,
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });
    return response.request.res.responseUrl;
  } catch (err) {
    return null;
  }
}

/**
 * API: Ambil gambar produk Tokopedia
 */
app.post("/api/images", async (req, res) => {
  try {
    let { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL tidak boleh kosong" });
    }

    // Resolve shortlink jika ada
    if (url.includes("vt.tokopedia.com")) {
      const resolved = await resolveShortlink(url);
      if (!resolved) {
        return res.status(400).json({ error: "Gagal resolve shortlink" });
      }
      url = resolved;
    }

    // Ambil product key
    const match = url.match(/tokopedia\.com\/([^\/]+)\/([^\/\?]+)/);
    if (!match) {
      return res.status(400).json({ error: "URL Tokopedia tidak valid" });
    }

    const shopDomain = match[1];
    const productKey = match[2];

    // GraphQL Tokopedia
    const graphqlResponse = await axios.post(
      "https://gql.tokopedia.com/graphql/PDPGetLayoutQuery",
      {
        variables: {
          shopDomain,
          productKey
        }
      },
      {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0",
          "Origin": "https://www.tokopedia.com"
        }
      }
    );

    const images =
      graphqlResponse.data?.data?.pdpGetLayout?.basicInfo?.media?.images || [];

    if (images.length === 0) {
      return res.status(404).json({ error: "Gambar tidak ditemukan" });
    }

    const imageUrls = images.map(img => img.urlOriginal);

    res.json({
      success: true,
      count: imageUrls.length,
      images: imageUrls
    });

  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Gagal mengambil gambar" });
  }
});

// Test endpoint
app.get("/health", (req, res) => {
  res.send("OK");
});

// Port Railway
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
