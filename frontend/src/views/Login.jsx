import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Shield, Key, Mail, AlertTriangle, Copy } from 'lucide-react';

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
      let friendlyError = result.message || 'Authentication failed. Please verify credentials.';
      const lowerErr = friendlyError.toLowerCase();
      if (lowerErr.includes('permission denied') || lowerErr.includes('row-level security') || lowerErr.includes('violates') || lowerErr.includes('rls')) {
        friendlyError = 'DATABASE_RLS_BLOCKED';
      }
      setError(friendlyError);
      setSubmitting(false);
    }
  };

  const sqlCode = `-- Execute this in Supabase SQL Editor to bypass Row Level Security blocks
ALTER TABLE public.employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_geofence DISABLE ROW LEVEL SECURITY;`;

  return (
    <div>
      <h2 className="text-lg font-bold text-white text-center font-sans tracking-wide mb-6 uppercase">Authorize User Session</h2>

      {error === 'DATABASE_RLS_BLOCKED' ? (
        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-200 text-xs font-sans leading-relaxed">
          <div className="flex items-center gap-2 text-amber-400 font-mono font-bold tracking-wider uppercase mb-2">
            <AlertTriangle className="w-4.5 h-4.5 shrink-0" />
            Supabase Security Blocked
          </div>
          <p className="mb-3 text-[11px]">
            Your Supabase project has <strong>Row Level Security (RLS)</strong> enabled, which is blocking the browser from accessing the database.
          </p>
          <div className="bg-slate-950/60 p-3 rounded-lg border border-amber-500/20 font-mono text-[10px] text-amber-300 overflow-x-auto max-h-32 mb-3 select-all">
            {sqlCode}
          </div>
          <p className="mb-3 text-[11px]">
            <strong>Quick Fix:</strong> Copy the code block above, open your <strong>Supabase Dashboard ➡️ SQL Editor ➡️ New Query</strong>, paste it, and click <strong>Run</strong>.
          </p>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(sqlCode);
              alert('SQL Code copied to clipboard!');
            }}
            className="w-full py-2.5 bg-amber-500/20 hover:bg-amber-500/35 border border-amber-500/30 rounded-xl text-amber-200 font-bold uppercase tracking-wider text-[10px] transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Copy className="w-3.5 h-3.5" />
            Copy Quick-Fix SQL Code
          </button>
        </div>
      ) : error && (
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
