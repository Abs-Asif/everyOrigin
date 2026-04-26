import * as cheerio from "cheerio";
import { proxyFetch } from "../../../lib/proxyFetcher";

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
      // Redirect to main API for images as requested
      const host = req.headers.host;
      const protocol = req.headers["x-forwarded-proto"] || "http";
      return res.redirect(`${protocol}://${host}/get?url=${encodeURIComponent(url)}`);
    }

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

    // Article extraction logic
    const extractArticle = () => {
      const selectors = [
        "article",
        ".article-body",
        ".entry-content",
        ".post-content",
        ".article__content",
        ".article-content",
        ".story-body",
        "#article-body",
        ".main-content",
        ".article-text",
        ".content-area",
      ];

      let articleText = "";
      for (const selector of selectors) {
        const el = $(selector);
        if (el.length) {
          const clone = el.clone();
          clone.find("script, style, iframe, nav, footer, header, aside, .ad, .ads, .social-share").remove();
          const text = clone.text().trim().replace(/\s+/g, " ");
          if (text.length > articleText.length) {
            articleText = text;
          }
        }
      }

      if (articleText.length < 200) {
        const paragraphs = [];
        $("p").each((i, el) => {
          const text = $(el).text().trim();
          if (text.length > 20) {
            paragraphs.push(text);
          }
        });
        if (paragraphs.length > 0) {
          const joinedP = paragraphs.join("\n\n");
          if (joinedP.length > articleText.length) {
            articleText = joinedP;
          }
        }
      }

      return articleText || description;
    };

    const article = extractArticle();

    let favicon =
      $('link[rel="apple-touch-icon"]').attr("href") ||
      $('link[rel="shortcut icon"]').attr("href") ||
      $('link[rel="icon"]').attr("href") ||
      "/favicon.ico";

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

    favicon = resolveUrl(favicon);
    const host = req.headers.host;
    const protocol = req.headers["x-forwarded-proto"] || "http";
    const proxiedFavicon = favicon ? `${protocol}://${host}/get?url=${encodeURIComponent(favicon)}` : "";

    const responseData = {
      title,
      description,
      article,
      siteName,
      favicon: proxiedFavicon,
      url,
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
