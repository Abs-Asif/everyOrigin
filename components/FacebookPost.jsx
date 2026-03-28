import {
  HandThumbUpIcon,
  ChatBubbleLeftIcon,
  ShareIcon,
  EllipsisHorizontalIcon,
  GlobeAmericasIcon
} from "@heroicons/react/24/outline";

export default function FacebookPost({
  authorName = "Unknown Author",
  authorAvatar,
  authorUrl = "#",
  postTime = "Just now",
  postText,
  postImage,
  imageAlt = "Facebook post image"
}) {
  const proxiedImage = (url) => {
    if (!url) return null;
    return `/get?url=${encodeURIComponent(url)}`;
  };

  return (
    <div className="mx-auto w-full max-w-[680px] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      {/* Header */}
      <div className="flex items-center justify-between p-3 pb-0">
        <div className="flex items-center gap-2">
          <div className="relative h-10 w-10 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
            {authorAvatar ? (
              <img
                src={proxiedImage(authorAvatar)}
                alt={authorName}
                className="h-full w-full object-cover"
                onError={(e) => (e.target.style.display = "none")}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-neutral-400">
                <span className="text-xs font-bold">{authorName.charAt(0)}</span>
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-1">
              <a
                href={authorUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[15px] font-semibold leading-tight text-neutral-900 hover:underline dark:text-neutral-100"
              >
                {authorName}
              </a>
            </div>
            <div className="flex items-center gap-1 text-[13px] text-neutral-500 dark:text-neutral-400">
              <span>{postTime}</span>
              <span>·</span>
              <GlobeAmericasIcon className="h-3 w-3" />
            </div>
          </div>
        </div>
        <button className="rounded-full p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800">
          <EllipsisHorizontalIcon className="h-5 w-5 text-neutral-500" />
        </button>
      </div>

      {/* Post Text */}
      {postText && (
        <div className="p-3 pt-2 text-[15px] leading-normal text-neutral-900 dark:text-neutral-100 whitespace-pre-wrap">
          {postText}
        </div>
      )}

      {/* Post Image */}
      {postImage && (
        <div className="mt-2 border-y border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950">
          <img
            src={proxiedImage(postImage)}
            alt={imageAlt}
            className="mx-auto max-h-[600px] w-full object-contain"
            onError={(e) => (e.target.style.display = "none")}
          />
        </div>
      )}

      {/* Interaction Counts (Mocked) */}
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2 dark:border-neutral-800">
        <div className="flex items-center gap-1">
          <div className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] text-white">
            <HandThumbUpIcon className="h-3 w-3 fill-current" />
          </div>
          <span className="text-[13px] text-neutral-500 dark:text-neutral-400 hover:underline cursor-pointer">12</span>
        </div>
        <div className="flex gap-3 text-[13px] text-neutral-500 dark:text-neutral-400">
          <span className="hover:underline cursor-pointer">5 comments</span>
          <span className="hover:underline cursor-pointer">2 shares</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-3 gap-1 p-1">
        <button className="flex items-center justify-center gap-2 rounded-md py-2 text-[15px] font-semibold text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800">
          <HandThumbUpIcon className="h-5 w-5" />
          <span>Like</span>
        </button>
        <button className="flex items-center justify-center gap-2 rounded-md py-2 text-[15px] font-semibold text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800">
          <ChatBubbleLeftIcon className="h-5 w-5" />
          <span>Comment</span>
        </button>
        <button className="flex items-center justify-center gap-2 rounded-md py-2 text-[15px] font-semibold text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800">
          <ShareIcon className="h-5 w-5" />
          <span>Share</span>
        </button>
      </div>
    </div>
  );
}
