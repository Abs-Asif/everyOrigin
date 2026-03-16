import * as cheerio from "cheerio";

export default async function handler(req, res) {
  const { method } = req;
  let { url } = req.query;

  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (method !== "GET") {
    return res.status(400).json({ success: false, error: `Unhandled request method: ${method}` });
  }

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  try {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }

    const response = await fetch(encodeURI(url));

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "";

    if (contentType.startsWith("image/")) {
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.setHeader("Content-Type", contentType);
      return res.status(200).send(buffer);
    }

    // Not an image, process as HTML/News
    const html = await response.text();
    const $ = cheerio.load(html);

    const title = $('meta[property="og:title"]').attr("content") || $("title").text() || "";
    let ogImage = $('meta[property="og:image"]').attr("content") || "";

    if (ogImage && !ogImage.startsWith("http")) {
      const urlObj = new URL(url);
      ogImage = new URL(ogImage, urlObj.origin).toString();
    }

    const host = req.headers.host;
    const protocol = req.headers["x-forwarded-proto"] || "http";
    const proxiedOgImage = ogImage ? `${protocol}://${host}/get?url=${encodeURIComponent(ogImage)}` : "";

    res.status(200).json({ title, image: proxiedOgImage });
  } catch (error) {
    console.error("Error fetching content:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}
