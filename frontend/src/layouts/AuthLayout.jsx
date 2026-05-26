import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ShieldCheck } from 'lucide-react';

export default function AuthLayout() {
  const { isAuthenticated, loading } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 app-shell aurora-sheet">
        <div className="page-card relative max-w-sm w-full overflow-hidden text-center animate-fade-up">
          <div className="spectrum-bar absolute left-0 right-0 top-0 h-1" />
          <div className="spectrum-logo force-white mx-auto mb-4 w-14 h-14 rounded-2xl flex items-center justify-center text-white">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div className="mx-auto w-12 h-12 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin"></div>
          <p className="mt-5 text-sm font-semibold text-slate-900">Restoring secure session</p>
          <p className="mt-1 text-sm text-slate-500">Loading your workspace and permissions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 app-shell aurora-sheet">
      <div className="absolute inset-0 soft-grid opacity-40 pointer-events-none"></div>
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="spectrum-logo force-white mx-auto w-16 h-16 rounded-2xl border border-white/70 flex items-center justify-center">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">Smart Attendance</h1>
          <p className="mt-2 text-sm text-slate-500">Premium AI attendance and geofence operations platform</p>
        </div>

        <div className="page-card relative overflow-hidden">
          <div className="spectrum-bar absolute left-0 right-0 top-0 h-1" />
          <Outlet />
        </div>
      </div>
    </div>
  );
}
