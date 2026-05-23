import React, { createContext, useState, useEffect, useContext } from 'react';
import { apiCall } from '../services/api.js';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder';
export const supabase = createClient(supabaseUrl, supabaseKey);

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('quantum_token') || null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Listen for Supabase Auth state changes natively
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        setToken(session.access_token);
        localStorage.setItem('quantum_token', session.access_token);
        
        // Supabase Auth doesn't have the full employee profile directly on session.user, 
        // we can fetch it via /auth/me or query the employees table
        if (!user) {
          verifyBackendToken(session.access_token);
        }
      } else {
        // If Supabase logs out, we check if there's a legacy token still
        const legacyToken = localStorage.getItem('quantum_legacy_token');
        if (!legacyToken) {
          handleLogout();
        }
      }
    });

    const initAuth = async () => {
      if (token) {
        if (user) {
          setIsAuthenticated(true);
          setLoading(false);
          return;
        }
        await verifyBackendToken(token);
      } else {
        setIsAuthenticated(false);
        setLoading(false);
      }
    };

    initAuth();

    return () => {
      subscription?.unsubscribe();
    };
  }, [token]);

  const verifyBackendToken = async (authToken) => {
    try {
      const response = await apiCall('/auth/me', 'GET', null, authToken);
      if (response.success && response.user) {
        setUser(response.user);
        setIsAuthenticated(true);
      } else {
        handleLogout();
      }
    } catch (err) {
      console.error('[AUTH ERROR]: Token verification failed', err);
      handleLogout();
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (email, password) => {
    setLoading(true);
    try {
      // Lazy Migration: Backend handles both Supabase and SQLite logic now!
      const data = await apiCall('/auth/login', 'POST', { email, password });
      
      if (data.success) {
        localStorage.setItem('quantum_token', data.token);
        if (data.legacyToken) localStorage.setItem('quantum_legacy_token', data.legacyToken);
        localStorage.setItem('quantum_user', JSON.stringify(data.user));
        
        setToken(data.token);
        setUser(data.user);
        setIsAuthenticated(true);

        // If backend returned a Supabase session, Supabase Auth state will automatically sync it
        if (data.session) {
          await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token
          });
        }
        
        return { success: true };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('[LOGIN ERROR]:', error);
      return { success: false, message: error.message || 'Network error occurred' };
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (profileData) => {
    try {
      const data = await apiCall('/auth/register', 'POST', profileData, token);
      return data;
    } catch (error) {
      console.error('[REGISTRATION ERROR]:', error);
      return { success: false, message: error.message || 'Failed to register employee' };
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('quantum_token');
    localStorage.removeItem('quantum_legacy_token');
    localStorage.removeItem('quantum_user');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    
    // Also sign out of Supabase
    await supabase.auth.signOut();
  };

  const value = {
    user,
    token,
    isAuthenticated,
    loading,
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
