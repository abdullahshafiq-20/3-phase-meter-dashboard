import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Zap, Eye, EyeOff, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loading, error, setError, isAuthenticated } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  const from = location.state?.from?.pathname || '/dashboard';

  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true });
  }, [isAuthenticated, from, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) { setError('Please fill in all fields'); return; }
    const ok = await login(username, password);
    if (ok) navigate(from, { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-grid-950 px-4">
      <div className="relative z-10 w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-cyan-electric/10 border border-cyan-electric/20 mb-4">
            <Zap className="w-8 h-8 text-cyan-electric" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            <span className="text-cyan-electric">Power</span>Grid
          </h1>
          <p className="text-grid-400 text-sm mt-2">Three-Phase Monitoring System</p>
        </div>

        {/* Form card */}
        <form onSubmit={handleSubmit} className="glass-panel p-8 space-y-6">
          <div>
            <label htmlFor="login-username" className="block text-xs font-semibold uppercase tracking-wider text-grid-400 mb-2">Username</label>
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-grid-900 border border-grid-700 rounded-lg px-4 py-3 text-slate-800 placeholder-grid-500 focus:outline-none focus:border-cyan-electric/50 focus:ring-1 focus:ring-cyan-electric/30 transition-all"
              placeholder="Enter username"
              autoComplete="username"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-xs font-semibold uppercase tracking-wider text-grid-400 mb-2">Password</label>
            <div className="relative">
              <input
                id="login-password"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-grid-900 border border-grid-700 rounded-lg px-4 py-3 pr-12 text-slate-800 placeholder-grid-500 focus:outline-none focus:border-cyan-electric/50 focus:ring-1 focus:ring-cyan-electric/30 transition-all"
                placeholder="Enter password"
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-grid-400 hover:text-slate-900 transition-colors">
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-alarm/10 border border-red-alarm/20 text-red-alarm rounded-lg px-4 py-3 text-sm animate-fade-in">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-cyan-electric hover:bg-cyan-glow text-white font-bold py-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>

          <p className="text-center text-xs text-grid-500">
            Demo: <span className="text-grid-400">admin / admin123</span> or <span className="text-grid-400">viewer / viewer123</span>
          </p>
        </form>
      </div>
    </div>
  );
}
