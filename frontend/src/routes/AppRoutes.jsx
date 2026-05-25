import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import AuthLayout from '../layouts/AuthLayout.jsx';
import DashboardLayout from '../layouts/DashboardLayout.jsx';
import ProtectedRoute from './ProtectedRoute.jsx';
import ErrorBoundary from '../context/ErrorBoundary.jsx';

// Views
import Login from '../views/Login.jsx';
import Dashboard from '../views/Dashboard.jsx';
import BiometricScanner from '../views/BiometricScanner.jsx';
import GeofenceSandbox from '../views/GeofenceSandbox.jsx';
import AdminPanel from '../views/AdminPanel.jsx';
import Profile from '../views/Profile.jsx';

export default function AppRoutes() {
  return (
    <Routes>
      {/* Authentication Layout Routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
      </Route>

      {/* Main Dashboard Layout Protected Routes */}
      <Route element={
        <ProtectedRoute>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route path="/dashboard" element={
          <ErrorBoundary>
            <Dashboard />
          </ErrorBoundary>
        } />
        <Route path="/scanner" element={
          <ErrorBoundary>
            <BiometricScanner />
          </ErrorBoundary>
        } />
        <Route path="/sandbox" element={
          <ErrorBoundary>
            <GeofenceSandbox />
          </ErrorBoundary>
        } />
        <Route path="/profile" element={
          <ErrorBoundary>
            <Profile />
          </ErrorBoundary>
        } />
        
        {/* Admin Restricted Paths */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <ErrorBoundary>
              <AdminPanel />
            </ErrorBoundary>
          </ProtectedRoute>
        } />
      </Route>

      {/* Catch-all Redirect Route */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
