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

const defaultUrl = "google.nl";
const baseUrl = "every-origin-ecru.vercel.app";

export const baseStyle = { transitionDuration: "650ms", transitionTimingFunction: "ease-out" };
export const hiddenStyle = { opacity: 0, transform: "translateY(3em)", filter: "blur(4px)" };

export default function Home() {
  const [url, setUrl] = useState(defaultUrl);
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [key, setKey] = useState(Date.now());
  const router = useRouter();
  const sampleCode = `const response = await fetch("https://${baseUrl}/get?url=${encodeURIComponent(
    url,
  )}");\nconst result = await response.json();`;

  useEffect(() => {
    hljs.highlightAll();
  }, [metadata, loading]);

  const fetchData = async () => {
    setError(null);
    const start = Date.now();
    try {
      if (!url) throw new Error("URL is required");
      const validUrl = new URL(!url.includes("http://") && !url.includes("https://") ? `https://${url}` : url);
      setLoading(true);
      const response = await fetch(`/api/get?url=${encodeURIComponent(validUrl.toString())}`);

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        setMetadata(data);
      } else if (contentType && contentType.startsWith("image/")) {
        // It's a direct image, we can show it as well
        setMetadata({ title: "Image Proxy Result", image: `/api/get?url=${encodeURIComponent(validUrl.toString())}` });
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
      className={`flex min-h-screen flex-col items-center justify-between gap-8 p-4 pt-12 text-neutral-900 sm:p-24 dark:text-neutral-100 ${inter.className}`}
    >
      <Head>
        <title>NEWSOrigin</title>
        <meta
          name="description"
          content="NEWSOrigin is a free CORS proxy for news sites. Get metadata and images without CORS issues."
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="relative m-auto place-items-center after:absolute after:top-0 after:-z-20 after:h-[180px] after:w-[180px] after:animate-[pulse_10s_ease-in-out_infinite] after:bg-gradient-conic after:from-sky-200 after:via-blue-200 after:blur-2xl after:content-[''] after:sm:w-[360px] before:lg:h-[360px] before:dark:bg-gradient-to-br before:dark:from-transparent before:dark:to-blue-700/10 after:dark:from-sky-900 after:dark:via-[#0141ff]/40">
        <h1 className="inline-block text-4xl font-bold sm:text-6xl" style={{ overflowWrap: "anywhere" }}>
          NEWSOrigin
        </h1>
        <h2 className="text-xl font-bold sm:text-3xl">Free CORS proxy for news</h2>
      </div>

      <div className="w-full max-w-4xl font-sans">
        <h2 className="mb-4 text-4xl font-bold">Usage</h2>
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2 dark:border-neutral-800 dark:bg-neutral-800/50">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-red-400"></div>
              <div className="h-3 w-3 rounded-full bg-yellow-400"></div>
              <div className="h-3 w-3 rounded-full bg-green-400"></div>
            </div>
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">API Explorer</span>
          </div>
          <div className="p-6">
            <h3 className="mb-4 text-lg font-semibold">Enter the URL to proxy</h3>
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 font-mono text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400">
              <span className="font-bold text-blue-600 dark:text-blue-400">API Endpoint:</span>
              <span className="break-all">{`https://${baseUrl}/get?url=`}</span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
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
              </div>
              <button
                className="rounded-lg bg-blue-600 px-6 py-2 font-bold text-white transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-50"
                onClick={fetchData}
                disabled={loading}
              >
                {loading ? "Fetching..." : "Execute"}
              </button>
            </div>
            <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
              Tip: Enter any news article URL or image URL.
            </p>
          </div>
        </div>
      </div>

      <div className="w-full max-w-4xl font-sans">
        <h2 className="mb-4 text-4xl font-bold">Documentation</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
            <h3 className="mb-3 text-xl font-bold text-blue-600 dark:text-blue-400">1. Image Mode</h3>
            <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
              If the URL points to an image (PNG, JPG, SVG, etc.), NEWSOrigin acts as a direct proxy, returning the image
              binary with the correct headers.
            </p>
            <div className="rounded bg-neutral-100 p-2 text-xs font-mono dark:bg-neutral-800">
              GET /get?url=example.com/image.png
            </div>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
            <h3 className="mb-3 text-xl font-bold text-blue-600 dark:text-blue-400">2. News Mode</h3>
            <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
              For web pages, NEWSOrigin extracts the Open Graph title and image, returning them as a JSON object for
              easy consumption.
            </p>
            <div className="rounded bg-neutral-100 p-2 text-xs font-mono dark:bg-neutral-800">
              {'{ "title": "...", "image": "..." }'}
            </div>
          </div>
        </div>
      </div>

      {loading && <Loader className="m-4" />}

      {error && !loading && <p className="p-4 text-red-500">Error: {error.message}</p>}
      {metadata && !loading && (
        <TransitionScroll baseStyle={baseStyle} hiddenStyle={hiddenStyle} className="w-full max-w-4xl">
          <div className="flex flex-col gap-6">
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
                  <h3 className="mb-2 text-2xl font-bold">{metadata.title || "No title found"}</h3>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    Extracted from Open Graph tags or page title.
                  </p>
                </div>
              </div>
            </div>

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
    </main>
  );
}
