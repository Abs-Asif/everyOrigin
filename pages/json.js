import { Inter } from "next/font/google";
import { useEffect, useState } from "react";
import hljs from "highlight.js/lib/common";
import "highlight.js/styles/github.css";
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

export default function JsonOrigin() {
  const [url, setUrl] = useState(defaultUrl);
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fetchTime, setFetchTime] = useState(null);
  const [key, setKey] = useState(Date.now());
  const [host, setHost] = useState("");
  const [protocol, setProtocol] = useState("https:");
  const [selectedFields, setSelectedFields] = useState([]);
  const [tooltipImage, setTooltipImage] = useState(null);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      setHost(window.location.host);
      setProtocol(window.location.protocol);
      window.showImageTooltip = (url) => {
        setTooltipImage(url);
      };
    }
  }, []);

  const fieldsParam = selectedFields.length > 0 ? `&fields=${selectedFields.join(",")}` : "";
  const sampleCode = `const response = await fetch("${protocol}//${
    host || "every-origin-ecru.vercel.app"
  }/get?url=${encodeURIComponent(url)}${fieldsParam}");\nconst result = await response.json();`;

  useEffect(() => {
    hljs.highlightAll();
  }, [metadata, loading]);

  const fetchData = async (overrideFields = null) => {
    setError(null);
    setFetchTime(null);
    const start = Date.now();
    try {
      if (!url) throw new Error("URL is required");
      const validUrl = new URL(!url.includes("http://") && !url.includes("https://") ? `https://${url}` : url);
      setLoading(true);

      const currentFields = overrideFields !== null ? overrideFields : selectedFields;
      const fParam = currentFields.length > 0 ? `&fields=${currentFields.join(",")}` : "";
      const response = await fetch(`/api/get?url=${encodeURIComponent(validUrl.toString())}${fParam}`);

      if (!response.ok) {
        let errorMessage = `Fetch failed with status ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error) errorMessage = errorData.error;
        } catch (e) {
          // Fallback to default message if JSON parsing fails
        }
        throw new Error(errorMessage);
      }

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        setMetadata(data);
      } else {
        throw new Error("Unexpected response from API");
      }

      triggerLoader(router);
      setKey(Date.now());
    } catch (error) {
      console.error("Error fetching data:", error);
      setError(error);
      setMetadata(null);
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

  const toggleField = async (field) => {
    const newFields = selectedFields.includes(field)
      ? selectedFields.filter((f) => f !== field)
      : [...selectedFields, field];
    setSelectedFields(newFields);
    await fetchData(newFields);
  };

  return (
    <main
      className={`flex min-h-screen flex-col items-center justify-between gap-6 p-4 pt-10 text-neutral-900 sm:gap-12 sm:p-12 md:p-24 dark:text-neutral-100 ${inter.className}`}
    >
      <Head>
        <title>JsonOrigin</title>
        <meta
          name="description"
          content="JsonOrigin - Structured JSON data from any webpage. Get metadata, headings, links, and more."
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="relative m-auto flex flex-col items-center after:absolute after:top-0 after:-z-20 after:h-[180px] after:w-[180px] after:animate-[pulse_10s_ease-in-out_infinite] after:bg-gradient-conic after:from-amber-200 after:via-orange-200 after:blur-2xl after:content-[''] after:sm:w-[360px] before:lg:h-[360px] before:dark:bg-gradient-to-br before:dark:from-transparent before:dark:to-orange-700/10 after:dark:from-amber-900 after:dark:via-[#ffae01]/40">
        <h1 className="text-center text-4xl font-extrabold tracking-tight sm:text-6xl" style={{ overflowWrap: "anywhere" }}>
          JsonOrigin
        </h1>
        <h2 className="mt-2 text-center text-lg font-medium opacity-80 sm:text-2xl md:text-3xl">
          Structured JSON from any webpage
        </h2>
      </div>

      <div className="w-full max-w-4xl font-sans">
        <h2 className="mb-4 text-2xl font-bold sm:text-4xl">Usage</h2>
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-3 py-2 sm:px-4 dark:border-neutral-800 dark:bg-neutral-800/50">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-red-400"></div>
              <div className="h-3 w-3 rounded-full bg-yellow-400"></div>
              <div className="h-3 w-3 rounded-full bg-green-400"></div>
            </div>
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">JSON Explorer</span>
          </div>
          <div className="p-4 sm:p-6">
            <h3 className="mb-4 text-base font-semibold sm:text-lg">Enter the URL to extract data</h3>
            <div className="mb-4 flex flex-col gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-3 font-mono text-xs text-neutral-600 sm:flex-row sm:items-center sm:gap-2 sm:text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400">
              <span className="font-bold text-orange-600 dark:text-orange-400 shrink-0">API Endpoint:</span>
              <span className="break-all overflow-hidden text-ellipsis">{`${protocol}//${
                host || "every-origin-ecru.vercel.app"
              }/get?url=`}</span>
            </div>
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
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Tip: Enter any webpage URL to see its structured data.
              </p>
              {fetchTime && (
                <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  Time: {fetchTime >= 1000 ? `${(fetchTime / 1000).toFixed(2)}s` : `${fetchTime}ms`}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {loading && <Loader className="m-4" />}

      {error && !loading && <p className="p-4 text-red-500">Error: {error.message}</p>}
      {metadata && !loading && (
        <TransitionScroll baseStyle={baseStyle} hiddenStyle={hiddenStyle} className="w-full max-w-4xl">
          <div className="flex flex-col gap-6">
            <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
              <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-2 dark:border-neutral-800 dark:bg-neutral-800/50">
                <span className="text-sm font-semibold">Request Maker (Filter Fields)</span>
              </div>
              <div className="p-4 sm:p-6">
                <div className="flex flex-wrap gap-2">
                  {[
                    "title",
                    "description",
                    "siteName",
                    "image",
                    "favicon",
                    "url",
                    "numPages",
                    "images",
                    "html",
                    "meta",
                    "headings",
                    "links",
                    "allImages",
                    "jsonLd",
                  ].map((field) => (
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
                  * Selecting fields will automatically update the result and API call code.
                </p>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4 py-2 dark:border-neutral-800 dark:bg-neutral-800/50">
                <span className="text-sm font-semibold">JSON Result</span>
                <button
                  className="rounded-full p-1 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700"
                  onClick={() => setMetadata(null)}
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6">
                <pre className="overflow-x-auto">
                    <code className="language-json text-sm" dangerouslySetInnerHTML={{
                      __html: hljs.highlight(JSON.stringify(metadata, null, 2), { language: "json" }).value
                        .replace(/"(https?:\/\/[^"]+)"/g, (match, url) => {
                          if (url.match(/\.(?:png|jpg|jpeg|gif|svg|webp|avif|bmp|ico)(?:\?.*)?$/i) || url.includes("/get?url=")) {
                            const safeUrl = url.replace(/'/g, "\\'");
                            return `"<span class="text-blue-500 cursor-pointer hover:underline underline-offset-4" onclick="window.showImageTooltip('${safeUrl}')">${url}</span>"`;
                          }
                          return match;
                        })
                    }} />
                </pre>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex justify-between border-b border-neutral-200 bg-slate-700 px-4 py-2 text-white">
                <span className="text-sm font-medium">API Usage Example</span>
                <ClipboardDocumentListIcon
                  title="Copy code to clipboard"
                  className="h-5 w-5 cursor-pointer transition-transform hover:scale-110 active:scale-95"
                  onClick={copySampleCode}
                />
              </div>
              <pre className="p-4 overflow-x-auto">
                <code id="sampleCode" className="language-javascript text-sm text-neutral-800 dark:text-neutral-200">
                  {sampleCode}
                </code>
              </pre>
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
              Get everything from a webpage: metadata, raw HTML, headings, links, images, and JSON-LD data.
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

      {tooltipImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setTooltipImage(null)}>
          <div className="relative max-w-4xl max-h-full overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-neutral-900" onClick={(e) => e.stopPropagation()}>
            <button
              className="absolute right-4 top-4 z-10 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
              onClick={() => setTooltipImage(null)}
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
            <div className="p-2">
              <img
                src={tooltipImage.startsWith("http") && !tooltipImage.includes("/get?url=") ? `/api/get?url=${encodeURIComponent(tooltipImage)}` : tooltipImage}
                alt="Preview"
                className="max-h-[80vh] w-auto object-contain"
                onError={(e) => (e.target.src = "https://via.placeholder.com/400x300?text=Image+Load+Error")}
              />
            </div>
            <div className="border-t border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-800/50">
              <p className="break-all text-xs text-neutral-500 dark:text-neutral-400">{tooltipImage}</p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
