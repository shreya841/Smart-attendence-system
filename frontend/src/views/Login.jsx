import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Shield, Key, Mail, AlertTriangle } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const result = await login(email, password);
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.message || 'Authentication failed. Please verify credentials.');
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-white text-center font-sans tracking-wide mb-6 uppercase">Authorize User Session</h2>

      {error && (
        <div className="mb-4 p-3.5 bg-cyber-red/10 border border-cyber-red/20 rounded-xl text-cyber-red flex items-start gap-2.5 text-xs font-mono">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase mb-2">Corporate Email</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
            <input
              type="email"
              required
              placeholder="e.g. employee@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full glass-input pl-11 text-sm text-slate-200"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase mb-2">Security Keyphrase</label>
          <div className="relative">
            <Key className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
            <input
              type="password"
              required
              placeholder="Enter password..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full glass-input pl-11 text-sm text-slate-200"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full mt-4 flex items-center justify-center gap-2 bg-gradient-to-r from-cyber-blue to-cyber-cyan hover:shadow-cyan-glow text-white font-semibold py-3.5 px-4 rounded-xl border border-cyan-400/20 active:scale-[0.98] transition-all duration-200 text-xs font-mono uppercase tracking-wider disabled:opacity-50"
        >
          <Shield className="w-4 h-4" />
          {submitting ? 'Authenticating...' : 'Establish Secure Connection'}
        </button>
      </form>

      {/* Quick Access Credentials Panel */}
      <div className="mt-6 p-4 rounded-xl border border-white/5 bg-slate-950/30 backdrop-blur-md">
        <h3 className="text-[9px] font-mono font-bold tracking-widest text-slate-400 uppercase mb-3 text-center">Quick Access Enclaves</h3>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => {
              setEmail('admin@company.com');
              setPassword('adminpassword');
            }}
            className="flex flex-col items-center justify-center p-2.5 rounded-lg border border-cyber-cyan/10 hover:border-cyber-cyan/40 bg-cyber-cyan/5 hover:bg-cyber-cyan/15 transition-all duration-300 text-center cursor-pointer group"
          >
            <span className="text-[10px] font-mono font-bold text-cyber-cyan group-hover:text-cyan-300">ADMINISTRATOR</span>
            <span className="text-[8px] font-mono text-slate-400 mt-1 select-none font-semibold">admin@company.com</span>
            <span className="text-[7px] font-mono text-slate-500 select-none">pass: adminpassword</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setEmail('employee@company.com');
              setPassword('employeepassword');
            }}
            className="flex flex-col items-center justify-center p-2.5 rounded-lg border border-cyber-blue/10 hover:border-cyber-blue/40 bg-cyber-blue/5 hover:bg-cyber-blue/15 transition-all duration-300 text-center cursor-pointer group"
          >
            <span className="text-[10px] font-mono font-bold text-cyber-blue group-hover:text-blue-300">EMPLOYEE</span>
            <span className="text-[8px] font-mono text-slate-400 mt-1 select-none font-semibold">employee@company.com</span>
            <span className="text-[7px] font-mono text-slate-500 select-none">pass: employeepassword</span>
          </button>
        </div>
      </div>

      <div className="mt-6 text-center">
        <p className="text-[10px] font-mono text-slate-500">
          Biometric enrollment restricted. Contact System Administrator.
        </p>
      </div>
    </div>
  );
}
