import { useDashboard } from "./state/dashboard.js";

function App() {
  const dashboard = useDashboard();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#fdf5d0,_#f8fafc_44%,_#dff5f3)] px-6 py-12 text-slate-950">
      <section className="mx-auto max-w-4xl rounded-[2rem] border border-slate-900/10 bg-white/80 p-8 shadow-2xl shadow-cyan-950/10 backdrop-blur sm:p-12">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
          Autonomous field notes
        </p>
        <h1 className="mt-4 font-serif text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
          Community Builder desk
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
          Daily ideas, assembled by an autonomous AWS research workflow.
        </p>

        <div className="mt-10 rounded-2xl border border-slate-900/10 bg-slate-950 p-6 text-left text-slate-100">
          {dashboard.posts.status === "loading" && (
            <p>Loading published ideas…</p>
          )}
          {dashboard.posts.status === "empty" && (
            <p>The next autonomous run is preparing the first idea.</p>
          )}
          {dashboard.posts.status === "error" && (
            <p>{dashboard.posts.message}</p>
          )}
          {dashboard.posts.status === "ready" && (
            <p>
              {dashboard.posts.posts.length} published ideas are ready to
              explore.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

export default App;
