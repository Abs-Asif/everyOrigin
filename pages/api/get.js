import * as cheerio from "cheerio";
import { proxyFetch } from "../../lib/proxyFetcher";

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

    const normalizedUrl = encodeURI(decodeURI(url));
    const response = await proxyFetch(normalizedUrl);

    if (!response || !response.ok) {
      throw new Error(response?.statusText || `Failed to fetch: ${response?.status || "Unknown error"}`);
    }

    const contentType =
      (typeof response.headers.get === "function" ? response.headers.get("content-type") : response.headers["content-type"]) ||
      "";

    if (contentType.startsWith("image/")) {
      const buffer = await response.buffer();
      res.setHeader("Content-Type", contentType);
      return res.status(200).send(buffer);
    }

    // Not an image, process as HTML/News
    const html = await response.text();
    if (!html) {
      throw new Error("Empty response body");
    }
    const $ = cheerio.load(html);

    const isPlaceholder = (text) => {
      if (!text) return true;
      const placeholders = ["just a moment...", "loading...", "please wait", "robot check"];
      return placeholders.some((p) => text.toLowerCase().includes(p));
    };

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

    let siteName = $('meta[property="og:site_name"]').attr("content") || "";

    // If metadata is generic or empty, try to extract from JSON-LD or Next.js data
    if (isPlaceholder(title) || !title || !description) {
      $('script[type="application/ld+json"]').each((i, el) => {
        try {
          const json = JSON.parse($(el).html());
          const findMeta = (obj) => {
            if (!obj || typeof obj !== "object") return;
            if (obj.headline && (!title || isPlaceholder(title))) title = obj.headline;
            if (obj.name && (!title || isPlaceholder(title))) title = obj.name;
            if (obj.description && !description) description = obj.description;
            if (obj.publisher && obj.publisher.name && !siteName) siteName = obj.publisher.name;
            Object.values(obj).forEach(findMeta);
          };
          findMeta(json);
        } catch (e) {}
      });

      if (isPlaceholder(title) || !title) {
        try {
          const nextData = JSON.parse($("#__NEXT_DATA__").html());
          if (nextData?.props?.pageProps?.post) {
            const post = nextData.props.pageProps.post;
            if (post.title && (!title || isPlaceholder(title))) title = post.title;
            if (post.excerpt && !description) description = post.excerpt;
          }
        } catch (e) {}
      }
    }

    // Image extraction and cleaning
    const extractImages = () => {
      const candidates = [];

      // Open Graph and Twitter
      $('meta[property="og:image"], meta[property="og:image:url"], meta[property="og:image:secure_url"]').each(
        (i, el) => {
          const content = $(el).attr("content");
          if (content) candidates.push(content);
        }
      );

      const twitterImage = $('meta[name="twitter:image"]').attr("content");
      if (twitterImage) candidates.push(twitterImage);

      // Link tags
      const imageSrc = $('link[rel="image_src"]').attr("href");
      if (imageSrc) candidates.push(imageSrc);

      // Schema.org ImageObject
      $('script[type="application/ld+json"]').each((i, el) => {
        try {
          const json = JSON.parse($(el).html());
          const findImages = (obj) => {
            if (!obj || typeof obj !== "object") return;
            if (obj.image) {
              if (typeof obj.image === "string") candidates.push(obj.image);
              else if (Array.isArray(obj.image))
                obj.image.forEach((img) => {
                  if (typeof img === "string") candidates.push(img);
                  else if (img.url) candidates.push(img.url);
                });
              else if (obj.image.url) candidates.push(obj.image.url);
            }
            if (obj.thumbnailUrl) candidates.push(obj.thumbnailUrl);
            Object.values(obj).forEach(findImages);
          };
          findImages(json);
        } catch (e) {
          // Ignore JSON parse errors
        }
      });

      // Common CMS featured image patterns
      const selectors = [
        ".wp-post-image",
        ".post-thumbnail img",
        ".featured-image img",
        ".entry-content img",
        "article img",
        ".main-content img",
        "#main-content img",
      ];
      selectors.forEach((s) => {
        $(s).each((i, el) => {
          const src = $(el).attr("src") || $(el).attr("data-src") || $(el).attr("data-lazy-src");
          if (src) candidates.push(src);
        });
      });

      return [...new Set(candidates)];
    };

    const cleanImageUrl = (imageUrl) => {
      if (!imageUrl) return "";
      try {
        const urlObj = new URL(imageUrl);
        // Common watermark/social share/tracking params to strip
        const paramsToStrip = [
          "watermark",
          "wm",
          "mark",
          "social_share",
          "share",
          "utm_source",
          "utm_medium",
          "utm_campaign",
          "fbclid",
          "gclid",
        ];
        paramsToStrip.forEach((p) => {
          urlObj.searchParams.delete(p);
          // Also check for prefix matches like watermark_path
          for (const key of urlObj.searchParams.keys()) {
            if (key.startsWith(p + "_") || key.startsWith(p + "-")) {
              urlObj.searchParams.delete(key);
            }
          }
        });

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

    let numPages = 0;
    if (url.includes("nhentai.net")) {
      // Common selectors for nhentai page count
      const infoText = $("#info").text();
      const pagesMatch = infoText.match(/(\d+)\s+pages/i);
      if (pagesMatch) {
        numPages = parseInt(pagesMatch[1]);
      } else {
        // Fallback to searching specific tag containers
        $(".tag-container").each((i, el) => {
          const text = $(el).text();
          if (/pages/i.test(text)) {
            const count = $(el).find(".name").text();
            if (count && !isNaN(count)) {
              numPages = parseInt(count);
            }
          }
        });
      }

      // If still not found, try searching all divs for the pattern
      if (!numPages) {
        $("div").each((i, el) => {
          const text = $(el).text().trim();
          const match = text.match(/^(\d+)\s+pages$/i);
          if (match) {
            numPages = parseInt(match[1]);
            return false;
          }
        });
      }
    }

    const host = req.headers.host;
    const protocol = req.headers["x-forwarded-proto"] || "http";
    const proxiedOgImage = selectedImage ? `${protocol}://${host}/get?url=${encodeURIComponent(selectedImage)}` : "";
    const proxiedFavicon = favicon ? `${protocol}://${host}/get?url=${encodeURIComponent(favicon)}` : "";

    // Extract all meta tags
    const metaTags = [];
    $("meta").each((i, el) => {
      const attributes = $(el).attr();
      metaTags.push(attributes);
    });

    // Extract headings
    const headings = {
      h1: [],
      h2: [],
      h3: [],
      h4: [],
      h5: [],
      h6: [],
    };
    ["h1", "h2", "h3", "h4", "h5", "h6"].forEach((tag) => {
      $(tag).each((i, el) => {
        headings[tag].push($(el).text().trim());
      });
    });

    // Extract all links
    const allLinks = [];
    $("a").each((i, el) => {
      const href = $(el).attr("href");
      if (href) {
        const resolved = resolveUrl(href);
        if (resolved && !allLinks.includes(resolved)) {
          allLinks.push(resolved);
        }
      }
    });

    // Extract all images
    const extractedImages = [];
    $("img").each((i, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src") || $(el).attr("data-lazy-src");
      if (src) {
        const resolved = resolveUrl(src);
        if (resolved && !extractedImages.includes(resolved)) {
          extractedImages.push(`${protocol}://${host}/get?url=${encodeURIComponent(resolved)}`);
        }
      }
    });

    // Extract all JSON-LD
    const jsonLdBlocks = [];
    $('script[type="application/ld+json"]').each((i, el) => {
      try {
        const json = JSON.parse($(el).html());
        jsonLdBlocks.push(json);
      } catch (e) {}
    });

    const responseData = {
      title,
      description,
      siteName,
      image: proxiedOgImage,
      favicon: proxiedFavicon,
      url,
      numPages,
      images: resolvedImages, // Keep all resolved for debugging/advanced use
      meta: metaTags,
      headings,
      links: allLinks,
      allImages: extractedImages,
      jsonLd: jsonLdBlocks,
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
