import https from "https";
import zlib from "zlib";
import { URL } from "url";
import cloudflareScraper from "cloudflare-scraper";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin());

const cookieJar = {};

const defaultHeaders = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "max-age=0",
  "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

const tlsOptions = {
  ciphers: [
    "ECDHE-RSA-AES128-GCM-SHA256",
    "ECDHE-RSA-AES256-GCM-SHA384",
    "ECDHE-RSA-AES128-SHA256",
    "ECDHE-RSA-AES256-SHA384",
  ].join(":"),
  secureProtocol: "TLSv1_2_method",
};

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function standardRequest(targetUrl, redirectCount = 0) {
  if (redirectCount > 5) {
    throw new Error("Too many redirects");
  }

  const urlObj = new URL(targetUrl);
  const domain = urlObj.hostname;
  const headers = { ...defaultHeaders };
  if (cookieJar[domain]) {
    headers["Cookie"] = cookieJar[domain];
  }

  return new Promise((resolve, reject) => {
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      port: urlObj.port || 443,
      method: "GET",
      ...tlsOptions,
      headers,
    };

    const req = https.request(options, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume(); // Consume the stream to avoid socket leaks
        const nextUrl = new URL(res.headers.location, targetUrl).toString();
        return resolve(standardRequest(nextUrl, redirectCount + 1));
      }

      if (res.headers["set-cookie"]) {
        const newCookies = res.headers["set-cookie"].map((c) => c.split(";")[0]).join("; ");
        cookieJar[domain] = cookieJar[domain] ? `${cookieJar[domain]}; ${newCookies}` : newCookies;
      }

      const contentEncoding = res.headers["content-encoding"];
      let stream = res;

      if (contentEncoding === "gzip") {
        stream = res.pipe(zlib.createGunzip());
      } else if (contentEncoding === "deflate") {
        stream = res.pipe(zlib.createInflate());
      } else if (contentEncoding === "br") {
        stream = res.pipe(zlib.createBrotliDecompress());
      }

      let data = [];
      stream.on("data", (chunk) => data.push(chunk));
      stream.on("end", () => {
        const buffer = Buffer.concat(data);

        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({
            text: async () => buffer.toString(),
            buffer: async () => buffer,
            headers: res.headers,
            status: res.statusCode,
            ok: true,
          });
        } else {
          resolve({
            ok: false,
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: res.headers,
          });
        }
      });

      stream.on("error", (err) => {
        res.resume();
        reject(err);
      });
    });

    req.on("error", (err) => reject(err));
    req.end();
  });
}

async function scraperRequest(url) {
  try {
    const response = await cloudflareScraper.get(url);
    return {
      text: async () => response.body,
      buffer: async () => Buffer.from(response.body),
      ok: true,
      status: 200,
      headers: response.headers,
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message,
    };
  }
}

async function puppeteerRequest(url) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders(defaultHeaders);
    const response = await page.goto(url, { waitUntil: "networkidle2" });
    const content = await page.content();
    const buffer = await response.buffer();

    return {
      text: async () => content,
      buffer: async () => buffer,
      ok: response.ok(),
      status: response.status(),
      headers: response.headers(),
    };
  } finally {
    await browser.close();
  }
}

export async function proxyFetch(url) {
  await delay(Math.random() * 2000 + 1000);

  // Attempt 1: Standard request with TLS, headers, decompression and redirects
  try {
    const res = await standardRequest(url);
    if (res.ok) return res;
    // Don't fallback on 404
    if (res.status === 404) return res;
  } catch (e) {
    console.error("Standard request failed:", e.message);
  }

  await delay(Math.random() * 2000 + 1000);

  // Attempt 2: Cloudflare Scraper
  try {
    const res = await scraperRequest(url);
    if (res.ok) return res;
  } catch (e) {
    console.error("Scraper request failed:", e.message);
  }

  await delay(Math.random() * 2000 + 1000);

  // Attempt 3: Puppeteer (Final fallback)
  try {
    return await puppeteerRequest(url);
  } catch (e) {
    console.error("Puppeteer request failed:", e.message);
    throw e;
  }
}
