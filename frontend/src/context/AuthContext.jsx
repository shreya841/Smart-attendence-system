import React, { createContext, useState, useEffect, useContext } from 'react';
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
    // Listen for Supabase Auth state changes natively
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AUTH STATE CHANGE EVENT]:', event);
      if (session) {
        setToken(session.access_token);
        localStorage.setItem('quantum_token', session.access_token);
        
        try {
          const { data: employee, error } = await supabase
            .from('employees')
            .select('id, name, email, role, department, avatar')
            .eq('email', session.user.email)
            .single();

          if (employee && !error) {
            setUser(employee);
            setIsAuthenticated(true);
          } else {
            console.warn('[AUTH STATE]: Logged-in user not found in employees table. Performing sign out.');
            // Only signOut if we are in signed-in state to prevent loop
            const curSession = await supabase.auth.getSession();
            if (curSession?.data?.session) {
              await supabase.auth.signOut();
            }
            localStorage.removeItem('quantum_token');
            localStorage.removeItem('quantum_user');
            setToken(null);
            setUser(null);
            setIsAuthenticated(false);
          }
        } catch (err) {
          console.error('[AUTH STATE FETCH ERROR]:', err);
          localStorage.removeItem('quantum_token');
          localStorage.removeItem('quantum_user');
          setToken(null);
          setUser(null);
          setIsAuthenticated(false);
        } finally {
          setLoading(false);
        }
      } else {
        localStorage.removeItem('quantum_token');
        localStorage.removeItem('quantum_user');
        setToken(null);
        setUser(null);
        setIsAuthenticated(false);
        setLoading(false);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const handleLogin = async (email, password) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        return { success: false, message: error.message };
      }

      // Fetch profile details
      const { data: employee, error: dbError } = await supabase
        .from('employees')
        .select('id, name, email, role, department, avatar')
        .eq('email', email)
        .single();

      if (dbError || !employee) {
        await supabase.auth.signOut();
        return { success: false, message: 'Employee profile not found in database.' };
      }

      localStorage.setItem('quantum_token', data.session.access_token);
      localStorage.setItem('quantum_user', JSON.stringify(employee));
      
      setToken(data.session.access_token);
      setUser(employee);
      setIsAuthenticated(true);
      
      return { success: true };
    } catch (error) {
      console.error('[LOGIN ERROR]:', error);
      return { success: false, message: error.message || 'Login failed due to a network error' };
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (profileData) => {
    // Standard employee registration is handled client-side inside api.js when POST /employees is called.
    const { apiCall } = await import('../services/api.js');
    try {
      const data = await apiCall('/employees', 'POST', profileData, token);
      return data;
    } catch (error) {
      console.error('[REGISTRATION ERROR]:', error);
      return { success: false, message: error.message || 'Failed to register employee' };
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('quantum_token');
    localStorage.removeItem('quantum_user');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    
    // Sign out of Supabase
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
