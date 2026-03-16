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
  const [htmlContent, setHtmlContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [key, setKey] = useState(Date.now());
  const router = useRouter();
  const sampleCode = `const response = await fetch("https://${baseUrl}/get?url=${encodeURIComponent(
    url,
  )}");\nconst result = await response.text();`;

  useEffect(() => {
    if (!htmlContent) return;
    hljs.highlightAll();
  }, [htmlContent, loading]);

  const fetchHtml = async () => {
    setError(null);
    const start = Date.now();
    try {
      if (!url) throw new Error("URL is required");
      const validUrl = new URL(!url.includes("http://") && !url.includes("https://") ? `https://${url}` : url);
      setLoading(true);
      const response = await fetch(`/api/get?url=${encodeURIComponent(validUrl.toString())}`);
      const { html } = await response.json();
      if (!html) throw new Error("No HTML content found");
      if (html === htmlContent) return;
      triggerLoader(router);
      setKey(Date.now());
      setHtmlContent(html);
    } catch (error) {
      console.error("Error fetching HTML:", error);
      setError(error);
      setHtmlContent("");
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
        <title>EveryOrigin</title>
        <meta
          name="description"
          content="EveryOrigin is a free CORS proxy that allows you to access the HTML content of any website from any origin. Free and open source."
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="relative m-auto place-items-center after:absolute after:top-0 after:-z-20 after:h-[180px] after:w-[180px] after:animate-[pulse_10s_ease-in-out_infinite] after:bg-gradient-conic after:from-sky-200 after:via-blue-200 after:blur-2xl after:content-[''] after:sm:w-[360px] before:lg:h-[360px] before:dark:bg-gradient-to-br before:dark:from-transparent before:dark:to-blue-700/10 after:dark:from-sky-900 after:dark:via-[#0141ff]/40">
        <h1 className="inline-block text-4xl font-bold sm:text-6xl" style={{ overflowWrap: "anywhere" }}>
          EveryOrigin
        </h1>
        <h2 className="text-xl font-bold sm:text-3xl">The free CORS proxy</h2>
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
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="group flex flex-grow items-center overflow-hidden rounded-lg border border-neutral-300 bg-neutral-50 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-neutral-700 dark:bg-neutral-800">
                <span className="hidden whitespace-nowrap bg-neutral-100 px-3 py-2 text-sm font-mono text-neutral-500 sm:block dark:bg-neutral-700 dark:text-neutral-400">
                  GET
                </span>
                <span className="whitespace-nowrap px-3 py-2 text-sm font-mono text-neutral-600 dark:text-neutral-300">
                  {`https://${baseUrl}/get?url=`}
                </span>
                <input
                  type="text"
                  className="w-full bg-transparent py-2 pr-3 font-mono text-sm outline-none placeholder:text-neutral-400"
                  placeholder="google.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value.trim())}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") await fetchHtml();
                  }}
                />
              </div>
              <button
                className="rounded-lg bg-blue-600 px-6 py-2 font-bold text-white transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-50"
                onClick={fetchHtml}
                disabled={loading}
              >
                {loading ? "Fetching..." : "Execute"}
              </button>
            </div>
            <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
              Tip: You can omit http:// or https://, we'll add it for you.
            </p>
          </div>
        </div>
      </div>

      {loading && <Loader className="m-4" />}

      {error && !loading && <p className="p-4">Error fetching HTML content: {error.message}</p>}
      {htmlContent && !loading && (
        <TransitionScroll baseStyle={baseStyle} hiddenStyle={hiddenStyle} className="flex flex-col items-center">
          <h2 className="my-2 text-lg font-bold">HTML Content:</h2>
          <pre key={key} className="relative shadow-lg">
            <button
              className="absolute right-2 top-2 origin-center transition-transform hover:scale-110 active:scale-95"
              onClick={() => setHtmlContent("")}
            >
              <XMarkIcon className="h-8 w-8 stroke-2 text-neutral-900" />
            </button>
            <code className="language-html max-w-[calc(100vw-4em)] overflow-hidden rounded bg-neutral-100 p-2 text-neutral-800">
              {htmlContent}
            </code>
          </pre>

          <h2 className="mb-2 mt-6 text-lg font-bold">Node Fetch Example Code:</h2>
          <pre className="relative shadow-lg">
            <div className="flex justify-between rounded-t bg-slate-700 px-2 py-1">
              <span>Language: JavaScript</span>
              <ClipboardDocumentListIcon
                title="Copy code to clipboard"
                className="h-6 w-6 cursor-pointer text-neutral-100 transition-transform hover:scale-110 active:scale-95"
                onClick={copySampleCode}
              />
            </div>
            <code
              id="sampleCode"
              className="language-javascript overflow-hidden rounded-b bg-neutral-100 p-2 text-neutral-800"
              onDoubleClick={copySampleCode}
            >
              {sampleCode}
            </code>
          </pre>
        </TransitionScroll>
      )}
    </main>
  );
}
