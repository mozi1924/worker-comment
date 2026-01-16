import CommentSystem from './components/CommentSystem';

function App() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 font-sans selection:bg-blue-100 text-slate-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="text-center mb-12 relative">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 mb-4 tracking-tight">
            Cloudflare Worker Comments
          </h1>
          <p className="text-slate-500 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed">
            A secure, serverless comment system powered by Cloudflare Workers, D1, and KV.
          </p>
        </header>

        <main className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden border border-slate-100 ring-1 ring-slate-900/5">
          <div className="p-1 md:p-2 bg-gradient-to-br from-slate-50/50 to-white">
              <CommentSystem
                siteId="demo-site"
                workerUrl="https://serverless-comment-backend.arasaka.ltd"
                turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || "1x00000000000000000000AA"}
              />
          </div>
        </main>

        <footer className="mt-12 text-center text-sm text-slate-400">
          Powered by Cloudflare Workers & React
        </footer>
      </div>
    </div>
  )
}

export default App;