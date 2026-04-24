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

    const userAgents = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; Googlebot-News; +http://www.google.com/bot.html)",
      "facebookexternalhit/1.1",
      "WhatsApp/2.21.12.21 A",
      "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
      "LinkedInBot/1.0 (compatible; Mozilla/5.0; Jakarta Commons-HttpClient/3.1 +http://www.linkedin.com)",
      "TelegramBot (like Twitterbot)",
      "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
    ];

    let response;
    let lastError;
    const normalizedUrl = encodeURI(decodeURI(url));

    const getHeaders = (ua) => {
      const headers = {
        "User-Agent": ua,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "en-US,en;q=0.9,bn;q=0.8",
        Referer: "https://www.google.com/",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      };

      if (ua.includes("Chrome")) {
        headers["Sec-Ch-Ua"] = '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"';
        headers["Sec-Ch-Ua-Mobile"] = ua.includes("Mobile") ? "?1" : "?0";
        headers["Sec-Ch-Ua-Platform"] = ua.includes("Windows") ? '"Windows"' : ua.includes("iPhone") ? '"iOS"' : '"Linux"';
        headers["Sec-Fetch-Dest"] = "document";
        headers["Sec-Fetch-Mode"] = "navigate";
        headers["Sec-Fetch-Site"] = "none";
        headers["Sec-Fetch-User"] = "?1";
        headers["Upgrade-Insecure-Requests"] = "1";
      }

      return headers;
    };

    for (const ua of userAgents) {
      try {
        response = await fetch(normalizedUrl, {
          headers: getHeaders(ua),
        });

        if (response.ok) break;

        lastError = `Failed to fetch: ${response.status} ${response.statusText}`;

        if (response.status === 404) {
          break;
        }

        if (response.status === 403 || response.status === 429 || response.status === 503) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (e) {
        lastError = e.message;
      }
    }

    if (!response || !response.ok) {
      throw new Error(lastError || `Failed to fetch: ${response?.statusText || "Unknown error"}`);
    }

    const contentType = response.headers.get("content-type") || "";

    if (contentType.startsWith("image/")) {
      // Redirect to main API for images as requested
      const host = req.headers.host;
      const protocol = req.headers["x-forwarded-proto"] || "http";
      return res.redirect(`${protocol}://${host}/get?url=${encodeURIComponent(url)}`);
    }

    const html = await response.text();
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
