import { Inter } from "next/font/google";
import { useEffect, useState } from "react";
import Loader from "@/components/loader";
import Head from "next/head";
import TransitionScroll from "react-transition-scroll";
import { useRouter } from "next/router";
import { triggerLoader } from "@/lib/utils";
import { XMarkIcon, ChevronLeftIcon } from "@heroicons/react/20/solid";
import FacebookPost from "@/components/FacebookPost";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"] });

const baseStyle = { transitionDuration: "650ms", transitionTimingFunction: "ease-out" };
const hiddenStyle = { opacity: 0, transform: "translateY(3em)", filter: "blur(4px)" };

export default function FacebookExtractor() {
  const [url, setUrl] = useState("");
  const [fbData, setFbData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fetchTime, setFetchTime] = useState(null);
  const router = useRouter();

  const fetchData = async () => {
    setError(null);
    setFetchTime(null);
    const start = Date.now();
    try {
      if (!url) throw new Error("Facebook URL is required");
      if (!url.includes("facebook.com")) throw new Error("Please enter a valid Facebook URL");

      setLoading(true);
      const response = await fetch(`/api/get?url=${encodeURIComponent(url)}`);

      if (!response.ok) {
        let errorMessage = `Fetch failed with status ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.error) errorMessage = errorData.error;
        } catch (e) {}
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (data.facebook) {
        setFbData(data.facebook);
      } else {
        // Fallback if specialized extraction failed but we have generic metadata
        setFbData({
          authorName: data.title || "Facebook User",
          postText: data.description || "No post text found.",
          postImage: data.image,
          authorAvatar: data.favicon, // Better than nothing
          authorUrl: url,
          postTime: "Public Post"
        });
      }

      triggerLoader(router);
    } catch (error) {
      console.error("Error fetching Facebook data:", error);
      setError(error);
      setFbData(null);
    } finally {
      const end = Date.now();
      const duration = end - start;
      setFetchTime(duration);
      if (duration < 1000) await new Promise((resolve) => setTimeout(resolve, 1000 - duration));
      setLoading(false);
    }
  };

  return (
    <main className={`flex min-h-screen flex-col items-center p-4 pt-10 text-neutral-900 sm:p-12 md:p-24 dark:text-neutral-100 ${inter.className}`}>
      <Head>
        <title>Facebook Post Extractor | NEWSOrigin</title>
        <meta name="description" content="Extract and preview Facebook posts in a native UI." />
      </Head>

      <div className="w-full max-w-4xl">
        <Link href="/" className="mb-8 flex items-center gap-1 text-sm font-medium text-neutral-500 hover:text-blue-600 dark:hover:text-blue-400">
          <ChevronLeftIcon className="h-4 w-4" />
          Back to Home
        </Link>

        <div className="mb-12 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
            FB Post Extractor
          </h1>
          <p className="mt-4 text-lg font-medium opacity-80 sm:text-xl">
            Preview Facebook posts in their native design
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
          <div className="p-4 sm:p-6">
            <h3 className="mb-4 text-base font-semibold sm:text-lg text-blue-600 dark:text-blue-400">Paste Facebook Post URL</h3>
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-2">
              <div className="group flex flex-grow items-center overflow-hidden rounded-lg border border-neutral-300 bg-neutral-50 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-neutral-700 dark:bg-neutral-800">
                <input
                  type="text"
                  className="w-full bg-transparent px-4 py-2 font-mono text-sm outline-none placeholder:text-neutral-400"
                  placeholder="https://www.facebook.com/zuck/posts/..."
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
                {loading ? "Extracting..." : "Extract"}
              </button>
            </div>
            {fetchTime && (
              <p className="mt-2 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400">
                Time: {fetchTime >= 1000 ? `${(fetchTime / 1000).toFixed(2)}s` : `${fetchTime}ms`}
              </p>
            )}
          </div>
        </div>

        {loading && <div className="mt-12 flex justify-center"><Loader /></div>}

        {error && !loading && (
          <div className="mt-8 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400">
            <p className="font-bold">Extraction Error</p>
            <p className="text-sm">{error.message}</p>
          </div>
        )}

        {fbData && !loading && (
          <TransitionScroll baseStyle={baseStyle} hiddenStyle={hiddenStyle} className="mt-12 pb-24">
            <div className="flex flex-col gap-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Native UI Preview</h2>
              <FacebookPost {...fbData} />
            </div>
          </TransitionScroll>
        )}
      </div>
    </main>
  );
}
