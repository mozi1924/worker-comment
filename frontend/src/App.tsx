import { useState, useEffect } from 'react';
import CommentSystem from './components/CommentSystem';
import AdminPanel from './components/AdminPanel';

function App() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Simple routing check
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'admin') {
      setIsAdmin(true);
    }
  }, []);

  const toggleAdmin = () => {
    const newMode = !isAdmin;
    setIsAdmin(newMode);
    const url = new URL(window.location.href);
    if (newMode) {
      url.searchParams.set('view', 'admin');
    } else {
      url.searchParams.delete('view');
    }
    window.history.pushState({}, '', url.toString());
  };

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
          
          <button 
            onClick={toggleAdmin}
            className="absolute top-0 right-0 text-xs text-slate-400 hover:text-blue-600 transition-colors opacity-50 hover:opacity-100"
          >
            {isAdmin ? 'View Site' : 'Admin'}
          </button>
        </header>

        <main className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden border border-slate-100 ring-1 ring-slate-900/5">
          <div className="p-1 md:p-2 bg-gradient-to-br from-slate-50/50 to-white">
            {isAdmin ? (
               <AdminPanel 
                 workerUrl="https://serverless-comment-backend.arasaka.ltd"
               />
            ) : (
              <CommentSystem
                siteId="demo-site"
                workerUrl="https://serverless-comment-backend.arasaka.ltd"
                turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || "1x00000000000000000000AA"}
              />
            )}
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