const express = require("express");
const axios = require("axios");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static("public"));

async function resolveShortlink(url) {
  const res = await axios.get(url, {
    maxRedirects: 5,
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });
  return res.request.res.responseUrl;
}

app.post("/api/images", async (req, res) => {
  try {
    let { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL kosong" });

    // resolve vt.tokopedia.com
    if (url.includes("vt.tokopedia.com")) {
      url = await resolveShortlink(url);
    }

    const match = url.match(/tokopedia\.com\/([^\/]+)\/([^\/\?]+)/);
    if (!match) return res.status(400).json({ error: "URL tidak valid" });

    const shopDomain = match[1];
    const productKey = match[2];

    const payload = {
      operationName: "PDPGetLayoutQuery",
      variables: { shopDomain, productKey },
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
      }`
    };

    const response = await axios.post(
      "https://gql.tokopedia.com/graphql/PDPGetLayoutQuery",
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0",
          "Origin": "https://www.tokopedia.com"
        }
      }
    );

    const images =
      response.data?.data?.pdpGetLayout?.basicInfo?.media?.images || [];

    res.json(images.map(i => i.urlOriginal));
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil gambar" });
  }
});

app.listen(3000, () => {
  console.log("✅ Server jalan di http://localhost:3000");
});
