import * as cheerio from "cheerio";

export default async function handler(req, res) {
  const { method } = req;
  let { url, fields } = req.query;

  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (method !== "GET") {
    return res.status(400).json({ success: false, error: `Unhandled request method: ${method}` });
  }

  const host = req.headers.host;
  const protocol = req.headers["x-forwarded-proto"] || "http";

  // If no URL is provided, fetch the Daily Bangladesh archive
  if (!url) {
    try {
      const response = await fetch("https://backoffice.daily-bangladesh.com/api-en/archive", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch archive: ${response.statusText}`);
      }

      const data = await response.json();

      // Transform archive data to include proxied images
      const transformedData = (data.archive_data || []).map(item => {
        const fullImageUrl = `https://backoffice.daily-bangladesh.com/media/imgAll/${item.ImageBgPath}`;
        return {
          ...item,
          ImageThumbPath: item.ImageThumbPath ? `https://backoffice.daily-bangladesh.com/media/imgAll/${item.ImageThumbPath}` : "",
          ImageSmPath: item.ImageSmPath ? `https://backoffice.daily-bangladesh.com/media/imgAll/${item.ImageSmPath}` : "",
          ImageBgPath: item.ImageBgPath ? fullImageUrl : "",
          proxiedImage: item.ImageBgPath ? `${protocol}://${host}/get?url=${encodeURIComponent(fullImageUrl)}` : ""
        };
      });

      return res.status(200).json({ archive_data: transformedData });
    } catch (error) {
      console.error("Error fetching archive:", error);
      return res.status(500).json({ error: error.message || "Internal Server Error" });
    }
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

    const title =
      $('meta[property="og:title"]').attr("content") ||
      $('meta[name="twitter:title"]').attr("content") ||
      $("title").text() ||
      "";

    const description =
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="twitter:description"]').attr("content") ||
      $('meta[name="description"]').attr("content") ||
      "";

    const siteName = $('meta[property="og:site_name"]').attr("content") || "";

    // Image extraction and cleaning
    const extractImages = () => {
      const candidates = [];
      const ogImages = $('meta[property="og:image"]');
      ogImages.each((i, el) => {
        const content = $(el).attr("content");
        if (content) candidates.push(content);
      });

      const twitterImage = $('meta[name="twitter:image"]').attr("content");
      if (twitterImage) candidates.push(twitterImage);

      const imageSrc = $('link[rel="image_src"]').attr("href");
      if (imageSrc) candidates.push(imageSrc);

      // Featured image fallback for WordPress sites
      const wpPostImage = $(".wp-post-image").attr("src");
      if (wpPostImage) candidates.push(wpPostImage);

      return [...new Set(candidates)];
    };

    const cleanImageUrl = (imageUrl) => {
      if (!imageUrl) return "";
      try {
        const urlObj = new URL(imageUrl);
        // Common watermark/social share params to strip
        const paramsToStrip = ["watermark", "wm", "mark", "social_share", "share"];
        paramsToStrip.forEach((p) => urlObj.searchParams.delete(p));
        return urlObj.toString();
      } catch (e) {
        return imageUrl;
      }
    };

    const allImages = extractImages();
    let selectedImage = "";

    const urlObj = new URL(url);

    const resolveUrl = (link) => {
      if (!link) return "";
      if (link.startsWith("http")) return link;
      try {
        return new URL(link, urlObj.origin).toString();
      } catch (e) {
        return "";
      }
    };

    const resolvedImages = allImages.map(resolveUrl).filter((img) => !!img);

    if (resolvedImages.length > 0) {
      // Prioritize images that don't contain "watermark" in their path/name
      const nonWatermarked = resolvedImages.filter((img) => !img.toLowerCase().includes("watermark"));
      if (nonWatermarked.length > 0) {
        selectedImage = cleanImageUrl(nonWatermarked[0]);
      } else {
        // If all have watermark, just pick the first and clean it
        selectedImage = cleanImageUrl(resolvedImages[0]);
      }
    }

    let favicon =
      $('link[rel="apple-touch-icon"]').attr("href") ||
      $('link[rel="shortcut icon"]').attr("href") ||
      $('link[rel="icon"]').attr("href") ||
      "/favicon.ico";

    favicon = resolveUrl(favicon);

    const proxiedOgImage = selectedImage ? `${protocol}://${host}/get?url=${encodeURIComponent(selectedImage)}` : "";
    const proxiedFavicon = favicon ? `${protocol}://${host}/get?url=${encodeURIComponent(favicon)}` : "";

    const responseData = {
      title,
      description,
      siteName,
      image: proxiedOgImage,
      favicon: proxiedFavicon,
      url,
      images: resolvedImages, // Keep all resolved for debugging/advanced use
    };

    if (fields) {
      const fieldList = fields.split(",").map((f) => f.trim());
      const filteredData = {};
      fieldList.forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(responseData, field)) {
          filteredData[field] = responseData[field];
        }
      });
      return res.status(200).json(filteredData);
    }

    res.status(200).json(responseData);
  } catch (error) {
    console.error("Error fetching content:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}
