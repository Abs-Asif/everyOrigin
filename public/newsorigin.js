(async () => {
  const SCRIPT_URL = new URL(document.currentScript.src);
  const BASE_URL = SCRIPT_URL.origin;

  // Metadata Extraction Logic
  async function extractMetadata(url) {
    if (!url.startsWith("http://") && !url.startsWith("https://")) url = "https://" + url;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("Fetch failed: " + resp.statusText);
    const ct = resp.headers.get("content-type") || "";
    if (ct.startsWith("image/")) return { isImage: true, contentType: ct, buffer: await resp.arrayBuffer() };

    const html = await resp.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
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

    const title = $('meta[property="og:title"]').attr("content") || $('meta[name="twitter:title"]').attr("content") || doc.title || "";
    const description = $('meta[property="og:description"]').attr("content") || $('meta[name="twitter:description"]').attr("content") || $('meta[name="description"]').attr("content") || "";
    const siteName = $('meta[property="og:site_name"]').attr("content") || "";

    const images = [];
    $('meta[property="og:image"]').each((i, e) => { if (e.attr("content")) images.push(e.attr("content")); });
    if ($('meta[name="twitter:image"]').attr("content")) images.push($('meta[name="twitter:image"]').attr("content"));

    const resolve = (l) => {
      if (!l) return "";
      if (l.startsWith("http")) return l;
      try { return new URL(l, url).toString(); } catch (e) { return ""; }
    };

    const resolvedImages = images.map(resolve).filter(i => !!i);
    const selectedImage = resolvedImages.length > 0 ? resolvedImages.find(i => !i.toLowerCase().includes("watermark")) || resolvedImages[0] : "";
    const favicon = resolve($('link[rel="apple-touch-icon"]').attr("href") || $('link[rel="shortcut icon"]').attr("href") || $('link[rel="icon"]').attr("href") || "/favicon.ico");

    return {
      title, description, siteName,
      image: selectedImage ? `${BASE_URL}/get?url=${encodeURIComponent(selectedImage)}` : "",
      favicon: favicon ? `${BASE_URL}/get?url=${encodeURIComponent(favicon)}` : "",
      url, images: resolvedImages
    };
  }

  // Define the global helper
  window.newsorigin = {
    fetch: async (url, options = {}) => {
      try {
        // Try on-device extraction first
        const result = await extractMetadata(url);

        // If it's an image, we still need to return a Response
        if (result.isImage) {
          return new Response(result.buffer, {
            headers: { 'Content-Type': result.contentType }
          });
        }

        // For metadata, return a JSON response
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (err) {
        // Fallback to server-side proxy
        const proxyUrl = `${BASE_URL}/get?url=${encodeURIComponent(url)}`;
        return fetch(proxyUrl, options);
      }
    }
  };

  // Optional: SW-based interception for SAME ORIGIN only
  if (window.location.origin === BASE_URL) {
    try {
      const ALMOSTNODE_URL = 'https://cdn.jsdelivr.net/npm/almostnode@0.2.14/dist/index.mjs';
      const { createContainer, getServerBridge } = await import(ALMOSTNODE_URL);
      const { vfs, runtime } = createContainer();
      const bridge = getServerBridge();

      await bridge.initServiceWorker({ swUrl: `${BASE_URL}/api/__sw__` });

      const virtualServer = {
        handle: async (req) => {
          const u = new URL(req.url, "http://localhost");
          const targetUrl = u.searchParams.get("url");
          if (!targetUrl) return { statusCode: 400, body: JSON.stringify({ error: "URL is required" }) };
          try {
            const res = await extractMetadata(targetUrl);
            if (res.isImage) {
              const bodyBase64 = btoa(new Uint8Array(res.buffer).reduce((d, b) => d + String.fromCharCode(b), ""));
              return { statusCode: 200, headers: { "Content-Type": res.contentType }, bodyBase64 };
            }
            return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(res) };
          } catch (err) { return { statusCode: 500, body: JSON.stringify({ error: err.message }) }; }
        }
      };

      bridge.registerServer(virtualServer, 80);
      window.NEWSOriginOnDevice = true;
      console.log("NEWSOrigin: On-device proxy initialized with SW interception.");
    } catch (e) {
      console.warn("NEWSOrigin: On-device SW proxy failed to init.", e);
    }
  } else {
    console.log("NEWSOrigin: Client-side helper initialized (CORS fallback to server). Use newsorigin.fetch(url) for automatic handling.");
  }
})();
