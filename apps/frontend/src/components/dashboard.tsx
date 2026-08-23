import type { PostContentState } from "../state/dashboard.js";
import type { GenerationRun, PostSummary } from "../types/api.js";
import { MarkdownArticle } from "./markdown.js";

const formatDate = (value: string): string =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));

export const PostHistory = ({
  posts,
  selectedPostId,
  onSelect,
}: {
  readonly posts: readonly PostSummary[];
  readonly selectedPostId: string | null;
  readonly onSelect: (postId: string) => void;
}) => (
  <nav aria-label="Published ideas" className="space-y-2">
    {posts.map((post) => {
      const selected = post.postId === selectedPostId;
      return (
        <button
          aria-pressed={selected}
          className={`w-full rounded-xl border p-4 text-left transition duration-200 ${
            selected
              ? "border-amber-300 bg-amber-100/80 shadow-sm"
              : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md"
          }`}
          key={post.postId}
          onClick={() => onSelect(post.postId)}
          type="button"
        >
          <span className="block text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">
            {formatDate(post.publishedAt)}
          </span>
          <span className="mt-2 block font-serif text-lg font-semibold leading-tight text-slate-950">
            {post.title}
          </span>
        </button>
      );
    })}
  </nav>
);

export const PostViewer = ({
  content,
}: {
  readonly content: PostContentState;
}) => {
  if (content.status === "loading") {
    return <p className="text-slate-500">Loading the selected field note…</p>;
  }
  if (content.status === "error") {
    return <p className="text-rose-700">{content.message}</p>;
  }
  if (content.status === "empty") {
    return (
      <p className="max-w-md text-lg leading-8 text-slate-600">
        The next autonomous run is preparing the first field note.
      </p>
    );
  }

  return (
    <div>
      <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">
        Published {formatDate(content.post.publishedAt)}
      </p>
      <h2 className="mt-3 font-serif text-4xl font-semibold tracking-tight text-slate-950">
        {content.post.title}
      </h2>
      <div className="mt-8 border-t border-slate-200 pt-2">
        <MarkdownArticle markdown={content.post.markdown} />
      </div>
    </div>
  );
};

export const RunStatus = ({ run }: { readonly run: GenerationRun | null }) => {
  if (!run) {
    return (
      <p className="text-sm leading-6 text-slate-500">
        Run status will appear after the first scheduled execution.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
      <span className="font-mono text-xs font-bold tracking-[0.16em] text-cyan-800">
        {run.status}
      </span>
      <span>{run.runId}</span>
      {run.failureStage && <span>Stage: {run.failureStage}</span>}
    </div>
  );
};
