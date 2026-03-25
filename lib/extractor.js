const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";

/**
 * Shared metadata extraction logic that works in both Node.js and the Browser.
 * In the browser, it uses DOMParser to avoid bundling heavy dependencies like Cheerio.
 * In Node.js, it uses Cheerio for reliable server-side parsing.
 */
async function loadCheerio() {
  if (isBrowser) {
    // Lightweight browser-native implementation of a subset of Cheerio
    return {
      load: (html) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const $ = (arg) => {
          let elements;
          if (typeof arg === "string") {
            elements = Array.from(doc.querySelectorAll(arg));
          } else if (arg && arg._el) {
            elements = [arg._el];
          } else if (arg && arg.nodeType) {
            elements = [arg];
          } else {
            elements = [];
          }

          const wrapper = {
            attr: (name) => elements[0]?.getAttribute(name) || "",
            text: () => elements[0]?.textContent || "",
            each: (callback) => {
              elements.forEach((el, i) => {
                callback(i, { _el: el, attr: (n) => el.getAttribute(n) });
              });
            },
            length: elements.length,
          };
          return wrapper;
        };
        return $;
      },
    };
  } else {
    // Node.js environment
    return await import("cheerio");
  }
}

/**
 * Extract news metadata from a given URL.
 */
export async function extractMetadata(url, { host, protocol } = {}) {
  // Prepend protocol if missing
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }

  const response = await fetch(encodeURI(url));

  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "";

  // Handle direct image proxying
  if (contentType.startsWith("image/")) {
    const arrayBuffer = await response.arrayBuffer();
    return {
      isImage: true,
      contentType,
      buffer: arrayBuffer,
    };
  }

  // Parse HTML
  const html = await response.text();
  const cheerio = await loadCheerio();
  const $ = cheerio.load(html);

  // Core metadata fields
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
      // Common watermark/social share params to strip for cleaner previews
      const paramsToStrip = ["watermark", "wm", "mark", "social_share", "share"];
      paramsToStrip.forEach((p) => urlObj.searchParams.delete(p));
      return urlObj.toString();
    } catch (e) {
      return imageUrl;
    }
  };

  const allImages = extractImages();
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
  let selectedImage = "";

  if (resolvedImages.length > 0) {
    // Prioritize images that don't contain "watermark" in their path/name
    const nonWatermarked = resolvedImages.filter((img) => !img.toLowerCase().includes("watermark"));
    if (nonWatermarked.length > 0) {
      selectedImage = cleanImageUrl(nonWatermarked[0]);
    } else {
      selectedImage = cleanImageUrl(resolvedImages[0]);
    }
  }

  // Favicon detection
  let favicon =
    $('link[rel="apple-touch-icon"]').attr("href") ||
    $('link[rel="shortcut icon"]').attr("href") ||
    $('link[rel="icon"]').attr("href") ||
    "/favicon.ico";

  favicon = resolveUrl(favicon);

  // If host/protocol provided, proxy the assets through ourselves to avoid further CORS issues
  const proxiedOgImage =
    selectedImage && host ? `${protocol}://${host}/get?url=${encodeURIComponent(selectedImage)}` : selectedImage;
  const proxiedFavicon = favicon && host ? `${protocol}://${host}/get?url=${encodeURIComponent(favicon)}` : favicon;

  return {
    title,
    description,
    siteName,
    image: proxiedOgImage,
    favicon: proxiedFavicon,
    url,
    images: resolvedImages,
  };
}
