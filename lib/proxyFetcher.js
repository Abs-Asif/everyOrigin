import https from "https";
import http from "http";
import zlib from "zlib";
import { URL } from "url";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

// Explicitly import some evasions to help Vercel's NFT (Next File Tracer)
// This is a workaround for "Cannot find module 'puppeteer-extra-plugin-stealth/evasions/chrome.app'"
try {
  require("puppeteer-extra-plugin-stealth/evasions/chrome.app");
  require("puppeteer-extra-plugin-stealth/evasions/chrome.csi");
  require("puppeteer-extra-plugin-stealth/evasions/chrome.loadTimes");
  require("puppeteer-extra-plugin-stealth/evasions/chrome.runtime");
  require("puppeteer-extra-plugin-stealth/evasions/iframe.contentWindow");
  require("puppeteer-extra-plugin-stealth/evasions/media.codecs");
  require("puppeteer-extra-plugin-stealth/evasions/navigator.languages");
  require("puppeteer-extra-plugin-stealth/evasions/navigator.permissions");
  require("puppeteer-extra-plugin-stealth/evasions/navigator.plugins");
  require("puppeteer-extra-plugin-stealth/evasions/navigator.webdriver");
  require("puppeteer-extra-plugin-stealth/evasions/sourceurl");
  require("puppeteer-extra-plugin-stealth/evasions/user-agent-override");
  require("puppeteer-extra-plugin-stealth/evasions/webgl.vendor");
  require("puppeteer-extra-plugin-stealth/evasions/window.outerdimensions");
} catch (e) {
  // Ignore errors during bundling or if some are missing
}

import chromium from "@sparticuz/chromium";

puppeteer.use(StealthPlugin());

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
  // Removed forced TLSv1.2 to allow negotiation of modern versions
};

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function standardRequest(targetUrl, cookies = "", redirectCount = 0) {
  if (redirectCount > 5) {
    throw new Error("Too many redirects");
  }

  const urlObj = new URL(targetUrl);
  const protocol = urlObj.protocol === "https:" ? https : http;
  const headers = { ...defaultHeaders };
  if (cookies) {
    headers["Cookie"] = cookies;
  }

  return new Promise((resolve, reject) => {
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      port: urlObj.port || (urlObj.protocol === "https:" ? 443 : 80),
      method: "GET",
      headers,
      ...(urlObj.protocol === "https:" ? tlsOptions : {}),
    };

    const req = protocol.request(options, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const nextUrl = new URL(res.headers.location, targetUrl).toString();

        // Merge cookies for redirect
        let nextCookies = cookies;
        if (res.headers["set-cookie"]) {
          const newCookies = res.headers["set-cookie"].map((c) => c.split(";")[0]).join("; ");
          nextCookies = cookies ? `${cookies}; ${newCookies}` : newCookies;
        }

        return resolve(standardRequest(nextUrl, nextCookies, redirectCount + 1));
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

async function puppeteerRequest(url) {
  const isLocal = process.env.NODE_ENV === "development" || !process.env.VERCEL;
  let browser;

  try {
    let executablePath = null;
    if (!isLocal) {
      executablePath = await chromium.executablePath();
    } else {
      // Try to find a local browser
      const localPaths = [
        "/usr/bin/google-chrome",
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      ];
      const fs = await import("fs");
      for (const path of localPaths) {
        if (fs.existsSync(path)) {
          executablePath = path;
          break;
        }
      }
    }

    browser = await puppeteer.launch({
      args: isLocal ? ["--no-sandbox", "--disable-setuid-sandbox"] : chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: executablePath,
      headless: isLocal ? true : chromium.headless,
    });

    const page = await browser.newPage();
    await page.setExtraHTTPHeaders(defaultHeaders);

    // Set a realistic viewport
    await page.setViewport({ width: 1280, height: 800 });

    const response = await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });

    if (!response) {
      throw new Error("No response from Puppeteer");
    }

    // Wait for a bit to let challenges resolve
    await delay(5000);

    const content = await page.content();

    // Check if we are still on a Cloudflare challenge page
    if (content.includes("Just a moment...") || content.includes("cf-challenge") || content.includes("challenges.cloudflare.com")) {
       // Try waiting longer
       await delay(10000);
    }

    const finalContent = await page.content();

    let buffer;
    try {
      buffer = await response.buffer();
    } catch (e) {
      // If buffer fails (e.g. navigation already happened or other reasons),
      // fallback to content as buffer
      buffer = Buffer.from(finalContent);
    }

    return {
      text: async () => finalContent,
      buffer: async () => buffer,
      ok: response.ok(),
      status: response.status(),
      headers: response.headers(),
    };
  } catch (error) {
    console.error("Puppeteer request error:", error);
    return {
      ok: false,
      status: 500,
      statusText: `Puppeteer error: ${error.message}`,
      text: async () => "",
      buffer: async () => Buffer.from(""),
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export async function proxyFetch(url) {
  await delay(Math.random() * 2000 + 1000);

  // Attempt 1: Standard request (No global cookie jar to prevent session leakage)
  try {
    const res = await standardRequest(url);
    if (res.ok) return res;
    if (res.status === 404) return res;
  } catch (e) {
    console.error("Standard request failed:", e.message);
  }

  await delay(Math.random() * 2000 + 1000);

  // Attempt 2: Puppeteer
  try {
    return await puppeteerRequest(url);
  } catch (e) {
    console.error("Puppeteer request failed:", e.message);
    throw e;
  }
}
