(async () => {
  const SCRIPT_URL = new URL(document.currentScript.src);
  const BASE_URL = SCRIPT_URL.origin;

  /**
   * Helper to convert an ArrayBuffer to a Base64 string safely even for large buffers.
   */
  async function bufferToBase64(buffer) {
    return new Promise((resolve) => {
      const blob = new Blob([buffer]);
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        resolve(dataUrl.split(",")[1]);
      };
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Metadata Extraction Logic
   */
  async function extractMetadata(url) {
    if (!url.startsWith("http://") && !url.startsWith("https://")) url = "https://" + url;

    let resp;
    try {
      resp = await fetch(url);
    } catch (e) {
      if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
        throw new Error("CORS_BLOCKED: The target website does not allow client-side access. Please use Server mode.");
      }
      throw e;
    }

    if (!resp.ok) throw new Error(`Fetch failed with status ${resp.status}`);
    const ct = resp.headers.get("content-type") || "";

    if (ct.startsWith("image/")) {
      return { isImage: true, contentType: ct, buffer: await resp.arrayBuffer() };
    }

    const html = await resp.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const $ = (s) => {
      const el = doc.querySelector(s);
      const els = Array.from(doc.querySelectorAll(s));
      return {
        attr: (n) => el?.getAttribute(n) || "",
        text: () => el?.textContent || "",
        each: (cb) => els.forEach((e, i) => cb(i, { attr: (n) => e.getAttribute(n) }))
      };
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
        const result = await extractMetadata(url);
        if (result.isImage) {
          return new Response(result.buffer, { headers: { 'Content-Type': result.contentType } });
        }
        return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
      } catch (err) {
        // Automatic fallback to server-side proxy
        console.warn("NEWSOrigin: On-device proxy failed, falling back to server.", err.message);
        const proxyUrl = `${BASE_URL}/get?url=${encodeURIComponent(url)}`;
        return fetch(proxyUrl, options);
      }
    }
  };

  // Same-origin SW setup
  if (window.location.origin === BASE_URL) {
    try {
      // Use esm.sh which automatically bundles dependencies like pako
      const ALMOSTNODE_URL = 'https://esm.sh/almostnode@0.2.14';
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
              const bodyBase64 = await bufferToBase64(res.buffer);
              return { statusCode: 200, headers: { "Content-Type": res.contentType }, bodyBase64 };
            }
            return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(res) };
          } catch (err) { return { statusCode: 500, body: JSON.stringify({ error: err.message }) }; }
        }
      };

      bridge.registerServer(virtualServer, 80);
      window.NEWSOriginOnDevice = true;
      console.log("NEWSOrigin: On-device proxy active (via Service Worker Bridge)");
    } catch (e) {
      console.warn("NEWSOrigin: On-device SW proxy failed to init.", e);
    }
  } else {
    console.log("NEWSOrigin: On-device helper ready. Use newsorigin.fetch(url) for automatic client/server proxying.");
  }
})();
