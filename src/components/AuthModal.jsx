import React, { useState } from 'react';
import authService from '../services/authService';

const AuthModal = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const data = await authService.login(username, password);
        onLoginSuccess(data);
      } else {
        const data = await authService.register(username, password);
        onLoginSuccess(data);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 z-[999] bg-[#000000] flex items-center justify-center font-mono-elite">
      <div className="elite-panel w-full max-w-md p-8 border border-[#1c2127]">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-[#00f2ff] tracking-widest uppercase mb-2">Roxey</h1>
          <div className="text-[10px] text-[#5d606b] uppercase tracking-[0.3em]">Authentication Gateway</div>
        </div>

        {error && (
          <div className="bg-[#ff003c]/10 text-[#ff003c] p-3 rounded mb-6 text-xs text-center border border-[#ff003c]/30">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-[10px] text-[#848e9c] uppercase tracking-widest mb-2">Operator ID</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#1c2127] rounded-lg px-4 py-3 text-sm text-[#d1d4dc] focus:outline-none focus:border-[#00f2ff] transition-all"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] text-[#848e9c] uppercase tracking-widest mb-2">Passkey</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#1c2127] rounded-lg px-4 py-3 text-sm text-[#d1d4dc] focus:outline-none focus:border-[#00f2ff] transition-all"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#00f2ff]/10 text-[#00f2ff] border border-[#00f2ff]/30 rounded-lg py-3 hover:bg-[#00f2ff]/20 transition-all font-bold tracking-widest disabled:opacity-50"
          >
            {loading ? 'AUTHENTICATING...' : (isLogin ? 'INITIALIZE LINK' : 'REGISTER OPERATOR')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-[10px] text-[#5d606b] hover:text-[#d1d4dc] uppercase tracking-widest transition-colors"
          >
            {isLogin ? 'Establish New Link →' : '← Return to Initializer'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
