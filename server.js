
const express = require("express");
const axios = require("axios");
const path = require("path");

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

/**
 * Resolve shortlink vt.tokopedia.com -> full tokopedia.com URL
 */
async function resolveShortlink(url) {
  try {
    const res = await axios.get(url, {
      maxRedirects: 5,
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });
    return res.request.res.responseUrl;
  } catch (err) {
    return url;
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

    // Resolve shortlink vt.tokopedia.com
    if (url.includes("vt.tokopedia.com")) {
      url = await resolveShortlink(url);
    }

    // Ambil shopDomain & productKey
    const match = url.match(/tokopedia\.com\/([^\/]+)\/([^\/\?]+)/);
    if (!match) {
      return res.status(400).json({ error: "URL Tokopedia tidak valid" });
    }

    const shopDomain = match[1];
    const productKey = match[2];

    // GraphQL Tokopedia
    const payload = {
      operationName: "PDPGetLayoutQuery",
      variables: {
        shopDomain,
        productKey
      },
      query: `
        query PDPGetLayoutQuery($shopDomain: String, $productKey: String) {
          pdpGetLayout(shopDomain: $shopDomain, productKey: $productKey) {
            basicInfo {
              media {
                images {
                  urlOriginal
                }
              }
            }
          }
        }
      `
    };

    const response = await axios.post(
      "https://gql.tokopedia.com/graphql/PDPGetLayoutQuery",
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0",
          "Origin": "https://www.tokopedia.com",
          "Referer": "https://www.tokopedia.com"
        },
        timeout: 15000
      }
    );

    const images =
      response.data?.data?.pdpGetLayout?.basicInfo?.media?.images || [];

    const urls = images.map(img => img.urlOriginal);

    res.json(urls);
  } catch (err) {
    console.error("ERROR:", err.message);
    res.status(500).json({ error: "Gagal mengambil gambar" });
  }
});

/**
 * Fallback route (frontend)
 */
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/**
 * START SERVER (WAJIB UNTUK RAILWAY)
 */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server jalan di port", PORT);
});
