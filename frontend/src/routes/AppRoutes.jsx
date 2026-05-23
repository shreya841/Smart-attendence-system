import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import AuthLayout from '../layouts/AuthLayout.jsx';
import DashboardLayout from '../layouts/DashboardLayout.jsx';
import ProtectedRoute from './ProtectedRoute.jsx';

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
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/scanner" element={<BiometricScanner />} />
        <Route path="/sandbox" element={<GeofenceSandbox />} />
        <Route path="/profile" element={<Profile />} />
        
        {/* Admin Restricted Paths */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminPanel />
          </ProtectedRoute>
        } />
      </Route>

      {/* Catch-all Redirect Route */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
