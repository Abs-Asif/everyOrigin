import { Inter } from "next/font/google";
import { useEffect, useState, useRef } from "react";
import hljs from "highlight.js/lib/common";
import "highlight.js/styles/atom-one-dark.css";
import Loader from "@/components/loader";
import Head from "next/head";
import TransitionScroll from "react-transition-scroll";
import { useRouter } from "next/router";
import { triggerLoader } from "@/lib/utils";
import { toast } from "react-toastify";
import { ClipboardDocumentListIcon, XMarkIcon } from "@heroicons/react/20/solid";

const inter = Inter({ subsets: ["latin"] });

const defaultUrl = "";

export const baseStyle = { transitionDuration: "650ms", transitionTimingFunction: "ease-out" };
export const hiddenStyle = { opacity: 0, transform: "translateY(3em)", filter: "blur(4px)" };

const ALL_FIELDS = [
  "title",
  "description",
  "siteName",
  "image",
  "favicon",
  "url",
  "numPages",
  "images",
  "meta",
  "headings",
  "links",
  "allImages",
  "jsonLd",
];

export default function JSONOrigin() {
  const [url, setUrl] = useState(defaultUrl);
  const [fullMetadata, setFullMetadata] = useState(null);
  const [displayedMetadata, setDisplayedMetadata] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fetchTime, setFetchTime] = useState(null);
  const [key, setKey] = useState(Date.now());
  const [host, setHost] = useState("");
  const [protocol, setProtocol] = useState("https:");
  const [selectedFields, setSelectedFields] = useState(ALL_FIELDS);
  const [tooltip, setTooltip] = useState({ show: false, url: "", x: 0, y: 0 });
  const router = useRouter();
  const tooltipRef = useRef(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setHost(window.location.host);
      setProtocol(window.location.protocol);
      window.showTooltip = (url, x, y) => {
        setTooltip({ show: true, url, x, y });
      };
      window.hideTooltip = () => {
        setTooltip((prev) => ({ ...prev, show: false }));
      };
    }
  }, []);

  const fieldsParam = selectedFields.length > 0 && selectedFields.length < ALL_FIELDS.length ? `&fields=${selectedFields.join(",")}` : "";
  const sampleCode = `const response = await fetch("${protocol}//${
    host || "every-origin-ecru.vercel.app"
  }/get?url=${encodeURIComponent(url || "https://example.com")}${fieldsParam}");\nconst result = await response.json();`;

  useEffect(() => {
    hljs.highlightAll();
  }, [displayedMetadata, loading]);

  useEffect(() => {
    if (fullMetadata) {
      const filtered = {};
      selectedFields.forEach((field) => {
        if (fullMetadata.hasOwnProperty(field)) {
          filtered[field] = fullMetadata[field];
        }
      });
      setDisplayedMetadata(filtered);
    }
  }, [selectedFields, fullMetadata]);

  const fetchData = async () => {
    setError(null);
    setFetchTime(null);
    const start = Date.now();
    try {
      if (!url) throw new Error("URL is required");
      const validUrl = new URL(!url.includes("http://") && !url.includes("https://") ? `https://${url}` : url);
      setLoading(true);

      const response = await fetch(`/api/get?url=${encodeURIComponent(validUrl.toString())}`);

      if (!response.ok) {
        let errorMessage = `Fetch failed with status ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error) errorMessage = errorData.error;
        } catch (e) {}
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setFullMetadata(data);

      triggerLoader(router);
      setKey(Date.now());
    } catch (error) {
      console.error("Error fetching data:", error);
      setError(error);
      setFullMetadata(null);
      setDisplayedMetadata(null);
    } finally {
      const end = Date.now();
      const duration = end - start;
      setFetchTime(duration);
      if (duration < 1000) await new Promise((resolve) => setTimeout(resolve, 1000 - duration));
      setLoading(false);
    }
  };

  const copySampleCode = async () => {
    toast.success("Code copied to clipboard");
    await navigator.clipboard.writeText(sampleCode);
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(document.getElementById("sampleCode"));
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const toggleField = (field) => {
    setSelectedFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
  };

  return (
    <main
      className={`flex min-h-screen flex-col items-center justify-between gap-6 p-4 pt-10 text-neutral-900 sm:gap-12 sm:p-12 md:p-24 dark:text-neutral-100 ${inter.className}`}
    >
      <Head>
        <title>JSONOrigin</title>
        <meta
          name="description"
          content="JSONOrigin - Structured JSON data from any webpage. Get metadata, headings, links, and more."
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="relative m-auto flex flex-col items-center after:absolute after:top-0 after:-z-20 after:h-[180px] after:w-[180px] after:animate-[pulse_10s_ease-in-out_infinite] after:bg-gradient-conic after:from-amber-200 after:via-orange-200 after:blur-2xl after:content-[''] after:sm:w-[360px] before:lg:h-[360px] before:dark:bg-gradient-to-br before:dark:from-transparent before:dark:to-orange-700/10 after:dark:from-amber-900 after:dark:via-[#ffae01]/40">
        <h1 className="text-center text-4xl font-extrabold tracking-tight sm:text-6xl" style={{ overflowWrap: "anywhere" }}>
          JSONOrigin
        </h1>
        <h2 className="mt-2 text-center text-lg font-medium opacity-80 sm:text-2xl md:text-3xl">
          Structured JSON from any webpage
        </h2>
      </div>

      <div className="w-full max-w-4xl font-sans">
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-3 py-2 sm:px-4 dark:border-neutral-800 dark:bg-neutral-800/50">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-red-400"></div>
              <div className="h-3 w-3 rounded-full bg-yellow-400"></div>
              <div className="h-3 w-3 rounded-full bg-green-400"></div>
            </div>
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">JSON Origin Explorer</span>
          </div>
          <div className="p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-2">
              <div className="group flex flex-grow items-center overflow-hidden rounded-lg border border-neutral-300 bg-neutral-50 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20 dark:border-neutral-700 dark:bg-neutral-800">
                <input
                  type="text"
                  className="w-full bg-transparent px-4 py-2 font-mono text-sm outline-none placeholder:text-neutral-400"
                  placeholder="https://news.ycombinator.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value.trim())}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") await fetchData();
                  }}
                />
                {url && (
                  <button
                    className="mr-2 rounded-full p-1 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
                    onClick={() => setUrl("")}
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                )}
              </div>
              <button
                className="rounded-lg bg-orange-600 px-6 py-2 font-bold text-white transition-all hover:bg-orange-700 active:scale-95 disabled:opacity-50"
                onClick={fetchData}
                disabled={loading}
              >
                {loading ? "Extracting..." : "Execute"}
              </button>
            </div>
            {fetchTime && (
                <p className="mt-2 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    Time: {fetchTime >= 1000 ? `${(fetchTime / 1000).toFixed(2)}s` : `${fetchTime}ms`}
                </p>
            )}
          </div>
        </div>
      </div>

      {loading && <Loader className="m-4" />}

      {error && !loading && <p className="p-4 text-red-500">Error: {error.message}</p>}
      {displayedMetadata && !loading && (
        <TransitionScroll baseStyle={baseStyle} hiddenStyle={hiddenStyle} className="w-full max-w-4xl">
          <div className="flex flex-col gap-6">
            {/* JSON Result First */}
            <div className="relative overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4 py-2 dark:border-neutral-800 dark:bg-neutral-800/50">
                <span className="text-sm font-semibold">JSON Result</span>
                <button
                  className="rounded-full p-1 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700"
                  onClick={() => setFullMetadata(null)}
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6 bg-[#282c34]">
                <pre className="overflow-x-auto">
                    <code className="language-json text-sm" dangerouslySetInnerHTML={{
                      __html: hljs.highlight(JSON.stringify(displayedMetadata, null, 2), { language: "json" }).value
                        .replace(/"(https?:\/\/[^"]+)"/g, (match, url) => {
                          if (url.match(/\.(?:png|jpg|jpeg|gif|svg|webp|avif|bmp|ico)(?:\?.*)?$/i) || url.includes("/get?url=")) {
                            const safeUrl = url.replace(/'/g, "\\'");
                            return `"<span class="text-blue-400 cursor-pointer hover:underline underline-offset-4" onmouseenter="window.showTooltip('${safeUrl}', event.clientX, event.clientY)" onmouseleave="window.hideTooltip()" onclick="window.showTooltip('${safeUrl}', event.clientX, event.clientY)">${url}</span>"`;
                          }
                          return match;
                        })
                    }} />
                </pre>
              </div>
            </div>

            {/* Request Maker Second */}
            <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
              <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-2 dark:border-neutral-800 dark:bg-neutral-800/50">
                <span className="text-sm font-semibold">Request Maker (Filter Fields)</span>
              </div>
              <div className="p-4 sm:p-6">
                <div className="flex flex-wrap gap-2">
                  {ALL_FIELDS.map((field) => (
                    <button
                      key={field}
                      onClick={() => toggleField(field)}
                      className={`rounded-full px-4 py-1 text-xs font-medium transition-all ${
                        selectedFields.includes(field)
                          ? "bg-orange-600 text-white shadow-md shadow-orange-500/30"
                          : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
                      }`}
                    >
                      {field}
                    </button>
                  ))}
                </div>
                <p className="mt-4 text-xs text-neutral-500 dark:text-neutral-400 italic">
                  * Selecting fields will automatically update the result preview and the generated code below.
                </p>
              </div>
            </div>

            {/* API Usage Example Third */}
            <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex justify-between border-b border-neutral-200 bg-slate-700 px-4 py-2 text-white">
                <span className="text-sm font-medium">Ready-to-use Code</span>
                <ClipboardDocumentListIcon
                  title="Copy code to clipboard"
                  className="h-5 w-5 cursor-pointer transition-transform hover:scale-110 active:scale-95"
                  onClick={copySampleCode}
                />
              </div>
              <div className="p-0 bg-[#282c34]">
                <pre className="p-4 overflow-x-auto">
                    <code id="sampleCode" className="language-javascript text-sm" dangerouslySetInnerHTML={{
                        __html: hljs.highlight(sampleCode, { language: "javascript" }).value
                    }} />
                </pre>
              </div>
            </div>
          </div>
        </TransitionScroll>
      )}

      <div className="w-full max-w-4xl font-sans">
        <h2 className="mb-4 text-2xl font-bold sm:text-4xl">Documentation</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:gap-6">
          <div className="rounded-xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-md dark:border-neutral-800 dark:bg-neutral-900">
            <h3 className="mb-3 text-xl font-bold text-orange-600 dark:text-orange-400">1. Full Extraction</h3>
            <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
              Get everything from a webpage: metadata, headings, links, images, and JSON-LD data.
            </p>
            <div className="rounded bg-neutral-100 p-2 text-xs font-mono dark:bg-neutral-800">
              GET /get?url=example.com
            </div>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-md dark:border-neutral-800 dark:bg-neutral-900">
            <h3 className="mb-3 text-xl font-bold text-orange-600 dark:text-orange-400">2. Structured Data</h3>
            <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
              Data is returned in a clean, predictable JSON format that's easy to integrate into your projects.
            </p>
            <div className="rounded bg-neutral-100 p-3 text-xs font-mono dark:bg-neutral-800 overflow-x-auto">
              <pre>{JSON.stringify({
                title: "...",
                description: "...",
                headings: { h1: [], more: "..." },
                links: [],
                allImages: [],
                jsonLd: []
              }, null, 2)}</pre>
            </div>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-md dark:border-neutral-800 dark:bg-neutral-900 sm:col-span-2 lg:col-span-1">
            <h3 className="mb-3 text-xl font-bold text-orange-600 dark:text-orange-400">3. Request Maker</h3>
            <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
              Use our interactive Request Maker to select only the fields you need, reducing response size and improving performance.
            </p>
            <div className="rounded bg-neutral-100 p-3 text-xs font-mono dark:bg-neutral-800 overflow-x-auto">
              <pre>GET /get?url=...&fields=title,links</pre>
            </div>
          </div>
        </div>
      </div>

      {tooltip.show && (
        <div
          ref={tooltipRef}
          className="fixed z-[100] pointer-events-none p-2 rounded-xl bg-white shadow-2xl border border-neutral-200 dark:bg-neutral-800 dark:border-neutral-700"
          style={{
            left: `${Math.min(tooltip.x + 20, typeof window !== 'undefined' ? window.innerWidth - 320 : 0)}px`,
            top: `${Math.min(tooltip.y + 20, typeof window !== 'undefined' ? window.innerHeight - 320 : 0)}px`,
          }}
        >
          <img
            src={tooltip.url.startsWith("http") && !tooltip.url.includes("/get?url=") ? `/get?url=${encodeURIComponent(tooltip.url)}` : tooltip.url}
            alt="Preview"
            className="max-w-[280px] max-h-[280px] rounded-lg object-contain"
            onError={(e) => (e.target.src = "https://via.placeholder.com/200?text=Error")}
          />
        </div>
      )}
    </main>
  );
}
