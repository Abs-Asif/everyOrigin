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

export default function Home() {
  const [url, setUrl] = useState(defaultUrl);
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fetchTime, setFetchTime] = useState(null);
  const [key, setKey] = useState(Date.now());
  const [host, setHost] = useState("");
  const [protocol, setProtocol] = useState("https:");
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      setHost(window.location.host);
      setProtocol(window.location.protocol);
    }
    fetchData(); // Fetch archive on mount
  }, []);

  const sampleCode = `const response = await fetch("${protocol}//${
    host || "every-origin-ecru.vercel.app"
  }/get?url=${encodeURIComponent(url)}");\nconst result = await response.json();`;

  useEffect(() => {
    hljs.highlightAll();
  }, [metadata, loading]);

  const fetchData = async () => {
    setError(null);
    setFetchTime(null);
    const start = Date.now();
    try {
      setLoading(true);
      let fetchUrl = "/api/get";
      let normalizedUrl = url;
      if (url) {
        const validUrl = new URL(!url.includes("http://") && !url.includes("https://") ? `https://${url}` : url);
        normalizedUrl = validUrl.toString();
        fetchUrl += `?url=${encodeURIComponent(normalizedUrl)}`;
      }
      const response = await fetch(fetchUrl);

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
      } else if (contentType && contentType.startsWith("image/")) {
        // It's a direct image, we can show it as well
        setMetadata({ title: "Image Proxy Result", image: `/api/get?url=${encodeURIComponent(normalizedUrl)}` });
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

  return (
    <main
      className={`flex min-h-screen flex-col items-center justify-between gap-6 p-4 pt-10 text-neutral-900 sm:gap-12 sm:p-12 md:p-24 dark:text-neutral-100 ${inter.className}`}
    >
      <Head>
        <title>Daily Bangladesh</title>
        <meta
          name="description"
          content="Daily Bangladesh is your source for the latest news from Bangladesh and around the world."
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="relative m-auto flex flex-col items-center after:absolute after:top-0 after:-z-20 after:h-[180px] after:w-[180px] after:animate-[pulse_10s_ease-in-out_infinite] after:bg-gradient-conic after:from-sky-200 after:via-blue-200 after:blur-2xl after:content-[''] after:sm:w-[360px] before:lg:h-[360px] before:dark:bg-gradient-to-br before:dark:from-transparent before:dark:to-blue-700/10 after:dark:from-sky-900 after:dark:via-[#0141ff]/40">
        <h1 className="text-center text-4xl font-extrabold tracking-tight sm:text-6xl" style={{ overflowWrap: "anywhere" }}>
          Daily Bangladesh
        </h1>
        <h2 className="mt-2 text-center text-lg font-medium opacity-80 sm:text-2xl md:text-3xl">
          Latest News and Archive
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
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">API Explorer</span>
          </div>
          <div className="p-4 sm:p-6">
            <h3 className="mb-4 text-base font-semibold sm:text-lg">Enter the URL to proxy</h3>
            <div className="mb-4 flex flex-col gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-3 font-mono text-xs text-neutral-600 sm:flex-row sm:items-center sm:gap-2 sm:text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400">
              <span className="font-bold text-blue-600 dark:text-blue-400 shrink-0">API Endpoint:</span>
              <span className="break-all overflow-hidden text-ellipsis">{`${protocol}//${
                host || "every-origin-ecru.vercel.app"
              }/get?url=`}</span>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-2">
              <div className="group flex flex-grow items-center overflow-hidden rounded-lg border border-neutral-300 bg-neutral-50 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-neutral-700 dark:bg-neutral-800">
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
                className="rounded-lg bg-blue-600 px-6 py-2 font-bold text-white transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-50"
                onClick={fetchData}
                disabled={loading}
              >
                {loading ? "Fetching..." : "Execute"}
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Tip: Enter any news article URL or image URL.
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
            {metadata.archive_data ? (
              <div className="grid gap-6 sm:grid-cols-2">
                {metadata.archive_data.map((item) => (
                  <div key={item.ContentID} className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
                    {item.proxiedImage && (
                      <div className="relative h-48 w-full overflow-hidden">
                        <img
                          src={item.proxiedImage}
                          alt={item.ContentHeading}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                    <div className="p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-xs font-bold uppercase text-blue-600 dark:text-blue-400">{item.CategoryName}</span>
                        <span className="text-xs text-neutral-500">{item.create_date}</span>
                      </div>
                      <h3 className="mb-2 text-lg font-bold leading-tight line-clamp-2">{item.ContentHeading}</h3>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-3">{item.ContentBrief}</p>
                      <a
                        href={`https://www.daily-bangladesh.com/english/${item.Slug}/${item.ContentID}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-block text-sm font-bold text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Read More →
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="relative overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
                <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4 py-2 dark:border-neutral-800 dark:bg-neutral-800/50">
                  <span className="text-sm font-semibold">Result Preview</span>
                  <button
                    className="rounded-full p-1 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700"
                    onClick={() => setMetadata(null)}
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
                <div className="flex flex-col p-6 sm:flex-row gap-6">
                  {metadata.image && (
                    <div className="relative h-48 w-full shrink-0 overflow-hidden rounded-lg sm:w-64">
                      <img
                        src={metadata.image}
                        alt={metadata.title}
                        className="h-full w-full object-cover"
                        onError={(e) => (e.target.style.display = "none")}
                      />
                    </div>
                  )}
                  <div className="flex flex-col justify-center">
                    <div className="mb-2 flex items-center gap-2">
                      {metadata.favicon && (
                        <img
                          src={metadata.favicon}
                          alt="favicon"
                          className="h-5 w-5"
                          onError={(e) => (e.target.style.display = "none")}
                        />
                      )}
                      {metadata.siteName && (
                        <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{metadata.siteName}</span>
                      )}
                    </div>
                    <h3 className="mb-2 text-2xl font-bold leading-tight">{metadata.title || "No title found"}</h3>
                    {metadata.description && (
                      <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400 line-clamp-3">
                        {metadata.description}
                      </p>
                    )}
                    <p className="text-xs text-neutral-500 dark:text-neutral-500 italic break-all">
                      Source: {metadata.url || url}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex justify-between border-b border-neutral-200 bg-slate-700 px-4 py-2 text-white">
                <span className="text-sm font-medium">Node Fetch Example</span>
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
            <h3 className="mb-3 text-xl font-bold text-blue-600 dark:text-blue-400">1. Image Mode</h3>
            <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
              If the URL points to an image (PNG, JPG, SVG, etc.), Daily Bangladesh acts as a direct proxy, returning the image
              binary with the correct headers.
            </p>
            <div className="rounded bg-neutral-100 p-2 text-xs font-mono dark:bg-neutral-800">
              GET /get?url=example.com/image.png
            </div>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-md dark:border-neutral-800 dark:bg-neutral-900">
            <h3 className="mb-3 text-xl font-bold text-blue-600 dark:text-blue-400">2. News Mode</h3>
            <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
              For web pages, Daily Bangladesh extracts rich metadata including Open Graph and Twitter tags, returning a comprehensive JSON object.
            </p>
            <div className="rounded bg-neutral-100 p-3 text-xs font-mono dark:bg-neutral-800 overflow-x-auto">
              <pre>{JSON.stringify({
                title: "...",
                description: "...",
                siteName: "...",
                image: "...",
                favicon: "...",
                url: "..."
              }, null, 2)}</pre>
            </div>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-md dark:border-neutral-800 dark:bg-neutral-900 sm:col-span-2 lg:col-span-1">
            <h3 className="mb-3 text-xl font-bold text-blue-600 dark:text-blue-400">3. Field Filtering</h3>
            <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
              Request specific data fields by providing a comma-separated <code>fields</code> parameter.
            </p>
            <div className="rounded bg-neutral-100 p-3 text-xs font-mono dark:bg-neutral-800 overflow-x-auto">
              <pre>GET /get?url=...&fields=title,favicon</pre>
              <pre className="mt-2">{JSON.stringify({
                title: "...",
                favicon: "..."
              }, null, 2)}</pre>
            </div>
          </div>
        </div>
      </div>

    </main>
  );
}
