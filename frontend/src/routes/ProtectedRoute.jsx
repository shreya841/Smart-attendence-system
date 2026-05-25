import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const { isAuthenticated, user, loading } = useAuth();

  // While auth hydration is in progress, hold here — never redirect during loading
  // This prevents the race where a valid session temporarily appears as unauthenticated
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cyber-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-cyber-cyan border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[10px] font-mono tracking-widest text-slate-500 uppercase animate-pulse">
            Restoring session...
          </p>
        </div>
      </div>
    );
  }

  // Only redirect to login AFTER hydration is complete and we are confirmed not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to Dashboard if user role is not allowed on this path
  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
