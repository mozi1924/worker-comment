import { useState } from 'react';
import { LoginPage } from './components/LoginPage';
import { Dashboard } from './components/Dashboard';

// Environment variable or default fallback (should match backend)
const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://serverless-comment-backend.arasaka.ltd';

function App() {
  const [token, setToken] = useState<string>(localStorage.getItem('admin_token') || '');
  
  const handleLogin = (newToken: string) => {
    setToken(newToken);
    localStorage.setItem('admin_token', newToken);
  };

  const handleLogout = () => {
    setToken('');
    localStorage.removeItem('admin_token');
  };

  // Optional: Validate token validity on mount? 
  // For now Dashboard handles 401 response by triggering logout

  return (
    <>
      {token ? (
        <Dashboard 
          workerUrl={WORKER_URL} 
          token={token} 
          onLogout={handleLogout} 
        />
      ) : (
        <LoginPage 
          workerUrl={WORKER_URL} 
          onLogin={handleLogin} 
        />
      )}
    </>
  );
}

export default App;
