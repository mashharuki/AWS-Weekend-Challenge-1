import { useEffect, useState } from "react";
import { PostHistory, PostViewer, RunStatus } from "./components/dashboard.js";
import { useDashboard, useSelectedPost } from "./state/dashboard.js";

function App() {
  const dashboard = useDashboard();
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const selectedPost = useSelectedPost(selectedPostId);

  useEffect(() => {
    if (
      dashboard.posts.status === "ready" &&
      !dashboard.posts.posts.some((post) => post.postId === selectedPostId)
    ) {
      setSelectedPostId(dashboard.posts.posts[0]?.postId ?? null);
    }
  }, [dashboard.posts, selectedPostId]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#fdf5d0,_#f8fafc_44%,_#dff5f3)] px-6 py-12 text-slate-950">
      <section className="mx-auto max-w-6xl rounded-[2rem] border border-slate-900/10 bg-white/80 p-8 shadow-2xl shadow-cyan-950/10 backdrop-blur sm:p-12">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
          Autonomous field notes
        </p>
        <h1 className="mt-4 font-serif text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
          Community Builder desk
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
          Daily ideas, assembled by an autonomous AWS research workflow.
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-[0.72fr_1.55fr]">
          <aside className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              Archive
            </p>
            <div className="mt-4">
              {dashboard.posts.status === "loading" && (
                <p className="text-slate-500">Loading published ideas…</p>
              )}
              {dashboard.posts.status === "empty" && (
                <p className="text-slate-500">No published ideas yet.</p>
              )}
              {dashboard.posts.status === "error" && (
                <p className="text-rose-700">{dashboard.posts.message}</p>
              )}
              {dashboard.posts.status === "ready" && (
                <PostHistory
                  onSelect={setSelectedPostId}
                  posts={dashboard.posts.posts}
                  selectedPostId={selectedPostId}
                />
              )}
            </div>
          </aside>

          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
            <PostViewer content={selectedPost} />
          </article>
        </div>

        <footer className="mt-8 border-t border-slate-200 pt-5">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            Latest autonomous run
          </p>
          <div className="mt-2">
            <RunStatus run={dashboard.latestRun} />
          </div>
        </footer>
      </section>
    </main>
  );
}

export default App;
