import React, { createContext, useState, useEffect, useContext } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder').replace('anon public ', '').trim();
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
      let { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      // Self-Healing Bootstrapper / Seed Generator
      if (error && (error.message.includes('Invalid login credentials') || error.message.includes('should be at least'))) {
        // 1. If it's the default admin and the database table is completely empty, trigger auto-seeding
        if (email === 'admin@company.com' && password === 'adminpassword') {
          const { data: listEmps } = await supabase.from('employees').select('id').limit(1);
          if (!listEmps || listEmps.length === 0) {
            console.log('[BOOTSTRAP SEEDING]: employees table is empty. Auto-seeding settings, admin, and employee...');
            
            // Seed settings
            await supabase.from('settings').upsert([
              { key: 'geofence_lat', value: '28.6139' },
              { key: 'geofence_lng', value: '77.2090' },
              { key: 'geofence_radius', value: '100' }
            ]);

            // SignUp Admin
            const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
              email: 'admin@company.com',
              password: 'adminpassword',
              options: {
                data: { name: 'Administrator', role: 'admin', department: 'Security & HR' }
              }
            });

            if (!signUpErr) {
              const desc = [];
              const lower = 'administrator';
              for (let i = 0; i < 128; i++) {
                let charVal = lower.charCodeAt(i % lower.length) / 128.0;
                desc.push(Math.sin(i * charVal) * 0.8 + 0.1);
              }
              const { encryptDescriptor } = await import('../services/api.js');
              const adminFace = await encryptDescriptor(desc);

              await supabase.from('employees').insert({
                id: 'EMP-001',
                name: 'Administrator',
                email: 'admin@company.com',
                password: 'adminpassword',
                role: 'admin',
                department: 'Security & HR',
                face_data: adminFace,
                status: 'Offline'
              });

              // Seed default Employee
              const empDesc = [];
              const empLower = 'standard employee';
              for (let i = 0; i < 128; i++) {
                let charVal = empLower.charCodeAt(i % empLower.length) / 128.0;
                empDesc.push(Math.sin(i * charVal) * 0.8 + 0.1);
              }
              const empFace = await encryptDescriptor(empDesc);

              await supabase.from('employees').insert({
                id: 'EMP-002',
                name: 'Standard Employee',
                email: 'employee@company.com',
                password: 'employeepassword',
                role: 'employee',
                department: 'Engineering',
                face_data: empFace,
                status: 'Offline'
              });

              if (signUpData?.session) {
                data = signUpData;
                error = null;
              }
            }
          }
        }

        // 2. If they exist in public.employees but not in Supabase Auth, silently register them
        if (error) {
          const { data: employee } = await supabase
            .from('employees')
            .select('*')
            .eq('email', email)
            .maybeSingle();

          if (employee) {
            console.log('[LAZY AUTH SEED]: Silently registering existing employee in Supabase Auth...', email);
            const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
              email,
              password,
              options: {
                data: {
                  name: employee.name,
                  role: employee.role,
                  department: employee.department
                }
              }
            });

            if (!signUpErr && signUpData?.session) {
              data = signUpData;
              error = null;
            }
          }
        }
      }

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
