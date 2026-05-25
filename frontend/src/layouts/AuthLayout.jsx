import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function AuthLayout() {
  const { isAuthenticated, loading } = useAuth();

  // If already authenticated (via cached session), redirect immediately — no spinner needed
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  // Show loading spinner ONLY when we have a pending token validation AND are NOT yet authenticated
  // This prevents the spinner from showing for new visitors (no token at all)
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0F19]">
        <div className="relative flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-cyber-cyan border-t-transparent rounded-full animate-spin shadow-cyan-glow"></div>
          <p className="mt-4 text-xs font-mono tracking-widest text-cyber-cyan animate-pulse">SYNCHRONIZING SECURITY ENCLAVE...</p>
          <p className="mt-2 text-[9px] font-mono text-slate-500 uppercase tracking-wider">Restoring session — please wait</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-[#0b0f19] cyber-grid">
      {/* Background Cyber Ambient Lights */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-cyber-cyan/5 rounded-full filter blur-[100px] animate-pulse-slow pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyber-blue/5 rounded-full filter blur-[120px] animate-pulse-slow pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10">
        {/* Brand Logo Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-tr from-cyber-blue to-cyber-cyan rounded-2xl flex items-center justify-center shadow-cyan-glow border border-cyan-400/20 mb-3 animate-pulse">
            <span className="text-2xl">🛡️</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-sans text-glow-cyan">
            QUANTUM<span className="text-cyber-cyan">GUARD</span>
          </h1>
          <p className="text-xs font-mono tracking-wider text-slate-400 mt-1 uppercase">AI-Powered Attendance & Geofencing</p>
        </div>

        {/* Outlet container */}
        <div className="glass-panel-heavy rounded-3xl p-8 shadow-2xl relative overflow-hidden corner-borders">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyber-cyan to-transparent"></div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
