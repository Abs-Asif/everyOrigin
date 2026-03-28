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

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  try {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }

    const isFacebook = url.includes("facebook.com");
    const fetchOptions = {};

    if (isFacebook) {
      // Use a bot user agent for Facebook to get metadata instead of a login redirect
      fetchOptions.headers = {
        "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      };
    }

    const response = await fetch(encodeURI(url), fetchOptions);

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

    let title =
      $('meta[property="og:title"]').attr("content") ||
      $('meta[name="twitter:title"]').attr("content") ||
      $("title").text() ||
      "";

    let description =
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="twitter:description"]').attr("content") ||
      $('meta[name="description"]').attr("content") ||
      "";

    const siteName = $('meta[property="og:site_name"]').attr("content") || (isFacebook ? "Facebook" : "");

    // Specialized extraction for Facebook if standard tags are missing
    let authorName = title;
    let postText = description;
    let postImage = "";
    let authorAvatar = "";
    let postTime = "Just now";

    if (isFacebook) {
      // Clean up title (often "Name - Post" or "Name - Home")
      authorName = title.split(" - ")[0].split(" | ")[0];

      // Look for data in script tags if og tags are missing or generic
      if (!description || description === "See posts, photos and more on Facebook.") {
        // Improved regex for post message to handle escaped quotes and larger content
        const postMessageMatch = html.match(/"post_message":\{"text":"(.*?)(?<!\\)"\}/);
        if (postMessageMatch) {
          postText = postMessageMatch[1].replace(/\\u([0-9a-fA-F]{4})/g, (match, grp) =>
            String.fromCharCode(parseInt(grp, 16))
          ).replace(/\\"/g, '"').replace(/\\n/g, '\n');
        }
      }

      // Try to find a better image if og:image is generic or missing
      const cometImageMatch = html.match(/"image":\{"uri":"(https:\\\/\\\/scontent[^"]+)"\}/);
      if (cometImageMatch) {
        postImage = cometImageMatch[1].replace(/\\\//g, "/");
      }

      // Try to find author avatar
      const avatarMatch = html.match(/"profile_picture":\{"uri":"(https:\\\/\\\/scontent[^"]+)"\}/);
      if (avatarMatch) {
        authorAvatar = avatarMatch[1].replace(/\\\//g, "/");
      }

      // Try to find post time (timestamp)
      const timestampMatch = html.match(/"publish_time":([0-9]{10})/);
      if (timestampMatch) {
        const date = new Date(parseInt(timestampMatch[1]) * 1000);
        postTime = date.toLocaleString();
      } else {
        const creationTimeMatch = html.match(/"creation_time":([0-9]{10})/);
        if (creationTimeMatch) {
           const date = new Date(parseInt(creationTimeMatch[1]) * 1000);
           postTime = date.toLocaleString();
        }
      }
    }

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

      if (postImage) candidates.unshift(postImage);

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

    const host = req.headers.host;
    const protocol = req.headers["x-forwarded-proto"] || "http";
    const proxiedOgImage = selectedImage ? `${protocol}://${host}/get?url=${encodeURIComponent(selectedImage)}` : "";
    const proxiedFavicon = favicon ? `${protocol}://${host}/get?url=${encodeURIComponent(favicon)}` : "";
    const proxiedAvatar = authorAvatar ? `${protocol}://${host}/get?url=${encodeURIComponent(authorAvatar)}` : "";

    const responseData = {
      title,
      description,
      siteName,
      image: proxiedOgImage,
      favicon: proxiedFavicon,
      url,
      images: resolvedImages,
      // Facebook specific
      facebook: isFacebook ? {
        authorName,
        authorAvatar: proxiedAvatar,
        postText,
        postImage: proxiedOgImage,
        postTime,
        authorUrl: url.split("/posts/")[0].split("/videos/")[0].split("/reels/")[0]
      } : null
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
