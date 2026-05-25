import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { encryptDescriptor, apiCall } from '../services/api.js';
import { supabase } from '../services/supabaseClient.js';

// Re-export for any remaining legacy imports
export { supabase };

const AuthContext = createContext(null);

// Timeout-safe fetchEmployeeProfile — never hangs longer than 5s
async function fetchEmployeeProfile(email) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('fetchEmployeeProfile timed out')), 5000)
  );
  const query = supabase
    .from('employees')
    .select('id, name, email, role, department, avatar')
    .eq('email', email)
    .single();

  try {
    const { data, error } = await Promise.race([query, timeout]);
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

// Try to read cached user from localStorage without any async calls
function getCachedUser() {
  try {
    const raw = localStorage.getItem('quantum_user');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export const AuthProvider = ({ children }) => {
  // Eagerly restore user from localStorage so UI has immediate data
  const cachedUser = getCachedUser();
  const hasToken = !!localStorage.getItem('quantum_token');

  const [user, setUser] = useState(cachedUser);
  const [token, setToken] = useState(() => localStorage.getItem('quantum_token') || null);
  // Immediately authenticated if we have both a cached user and token — prevents flash
  const [isAuthenticated, setIsAuthenticated] = useState(!!(cachedUser && hasToken));
  // Only show loading spinner if we have a token to validate — otherwise start ready
  const [loading, setLoading] = useState(hasToken);

  const mountedRef = useRef(true);
  const initializedRef = useRef(false);
  const failsafeTimerRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;

    const resolveLoading = () => {
      if (mountedRef.current) {
        setLoading(false);
        initializedRef.current = true;
        if (failsafeTimerRef.current) {
          clearTimeout(failsafeTimerRef.current);
        }
      }
    };

    // Failsafe: guarantee loading always resolves within 4s no matter what
    failsafeTimerRef.current = setTimeout(() => {
      if (!initializedRef.current) {
        console.warn('[AUTH FAILSAFE]: Hydration did not resolve in 4s. Forcing unlock.');
        // If we have a cached user/token still, keep them authenticated
        // rather than kicking them to login
        if (mountedRef.current) {
          setLoading(false);
          initializedRef.current = true;
        }
      }
    }, 4000);

    const init = async () => {
      // If no stored token at all — we're definitely not logged in, resolve immediately
      if (!hasToken) {
        resolveLoading();
        return;
      }

      try {
        // STEP 1: Call getSession() — reads from localStorage, fast on refresh
        const { data: { session }, error } = await supabase.auth.getSession();

        if (!mountedRef.current) return;

        if (session && session.user) {
          // Valid Supabase session — update token
          const newToken = session.access_token;
          localStorage.setItem('quantum_token', newToken);
          if (mountedRef.current) setToken(newToken);

          // STEP 2: Validate employee profile against DB (timeout-safe)
          const employee = await fetchEmployeeProfile(session.user.email);

          if (!mountedRef.current) return;

          if (employee) {
            // Confirmed valid — update state and persist fresh user data
            localStorage.setItem('quantum_user', JSON.stringify(employee));
            setUser(employee);
            setIsAuthenticated(true);
          } else {
            // Valid session but no employee profile — sign out
            console.warn('[AUTH]: Session valid but no employee profile found. Signing out.');
            localStorage.removeItem('quantum_token');
            localStorage.removeItem('quantum_user');
            setToken(null);
            setUser(null);
            setIsAuthenticated(false);
            supabase.auth.signOut().catch(() => {});
          }
        } else {
          // No active Supabase session — clear everything
          localStorage.removeItem('quantum_token');
          localStorage.removeItem('quantum_user');
          if (mountedRef.current) {
            setToken(null);
            setUser(null);
            setIsAuthenticated(false);
          }
        }
      } catch (err) {
        console.error('[AUTH INIT ERROR]:', err);
        // On any error: if we still have a cached user, keep them authenticated
        // This prevents a network hiccup from logging someone out on refresh
        const stillCachedUser = getCachedUser();
        const stillHasToken = !!localStorage.getItem('quantum_token');
        if (mountedRef.current && stillCachedUser && stillHasToken) {
          console.log('[AUTH]: Network error during hydration, using cached session.');
          setUser(stillCachedUser);
          setIsAuthenticated(true);
        } else if (mountedRef.current) {
          localStorage.removeItem('quantum_token');
          setToken(null);
          setUser(null);
          setIsAuthenticated(false);
        }
      } finally {
        resolveLoading();
      }
    };

    init();

    // STEP 3: Subscribe to onAuthStateChange for real-time session events
    // (logout from another tab, token refresh) — skip INITIAL_SESSION since init() handles it
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // INITIAL_SESSION is already handled by getSession() above
      if (event === 'INITIAL_SESSION') return;

      console.log('[AUTH STATE CHANGE EVENT]:', event);

      if (event === 'SIGNED_OUT') {
        if (mountedRef.current) {
          localStorage.removeItem('quantum_token');
          localStorage.removeItem('quantum_user');
          setToken(null);
          setUser(null);
          setIsAuthenticated(false);
        }
        return;
      }

      if (event === 'TOKEN_REFRESHED' && session) {
        if (mountedRef.current) {
          setToken(session.access_token);
          localStorage.setItem('quantum_token', session.access_token);
        }
        return;
      }

      if (session && session.user) {
        if (mountedRef.current) {
          setToken(session.access_token);
          localStorage.setItem('quantum_token', session.access_token);
        }

        try {
          const employee = await fetchEmployeeProfile(session.user.email);
          if (!mountedRef.current) return;
          if (employee) {
            localStorage.setItem('quantum_user', JSON.stringify(employee));
            setUser(employee);
            setIsAuthenticated(true);
          } else {
            localStorage.removeItem('quantum_token');
            localStorage.removeItem('quantum_user');
            setToken(null);
            setUser(null);
            setIsAuthenticated(false);
            supabase.auth.signOut().catch(() => {});
          }
        } catch (err) {
          console.error('[AUTH STATE FETCH ERROR]:', err);
        }
      }
    });

    return () => {
      mountedRef.current = false;
      if (failsafeTimerRef.current) clearTimeout(failsafeTimerRef.current);
      subscription?.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogin = async (email, password) => {
    try {
      let { data, error } = await supabase.auth.signInWithPassword({ email, password });

      // Self-Healing Bootstrapper
      if (error && (error.message.includes('Invalid login credentials') || error.message.includes('User not found'))) {
        if (email === 'admin@company.com' && password === 'adminpassword') {
          const { data: adminEmp } = await supabase.from('employees').select('id').eq('email', 'admin@company.com').maybeSingle();
          if (!adminEmp) {
            console.log('[BOOTSTRAP SEEDING]: Auto-seeding admin...');
            await supabase.from('settings').upsert([
              { key: 'geofence_lat', value: '28.6139' },
              { key: 'geofence_lng', value: '77.2090' },
              { key: 'geofence_radius', value: '100' }
            ]);
            await supabase.auth.signUp({ email: 'admin@company.com', password: 'adminpassword', options: { data: { name: 'Administrator', role: 'admin', department: 'Security & HR' } } });
            const desc = [];
            const lower = 'administrator';
            for (let i = 0; i < 128; i++) desc.push(Math.sin(i * lower.charCodeAt(i % lower.length) / 128.0) * 0.8 + 0.1);
            const adminFace = await encryptDescriptor(desc);
            await supabase.from('employees').upsert({ id: 'EMP-001', name: 'Administrator', email: 'admin@company.com', password: 'adminpassword', role: 'admin', department: 'Security & HR', face_data: adminFace, status: 'Offline' });
            const stdEmp = await supabase.from('employees').select('id').eq('email', 'employee@company.com').maybeSingle();
            if (!stdEmp.data) {
              const empDesc = [];
              const empLower = 'standard employee';
              for (let i = 0; i < 128; i++) empDesc.push(Math.sin(i * empLower.charCodeAt(i % empLower.length) / 128.0) * 0.8 + 0.1);
              await supabase.from('employees').insert({ id: 'EMP-002', name: 'Standard Employee', email: 'employee@company.com', password: 'employeepassword', role: 'employee', department: 'Engineering', face_data: await encryptDescriptor(empDesc), status: 'Offline' });
            }
            const retryRes = await supabase.auth.signInWithPassword({ email, password });
            if (!retryRes.error) { data = retryRes.data; error = null; }
          }
        }

        if (error) {
          const { data: employee } = await supabase.from('employees').select('*').eq('email', email).maybeSingle();
          if (employee) {
            const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({ email, password, options: { data: { name: employee.name, role: employee.role, department: employee.department } } });
            if (!signUpErr && signUpData?.session) { data = signUpData; error = null; }
            else if (signUpErr?.message?.includes('already registered')) {
              const retryRes = await supabase.auth.signInWithPassword({ email, password });
              if (!retryRes.error) { data = retryRes.data; error = null; }
            }
          }
        }
      }

      if (error) return { success: false, message: error.message };
      if (!data?.session) return { success: false, message: 'Authentication session not found.' };

      // Eagerly set auth state from login response (don't wait for onAuthStateChange)
      const employee = await fetchEmployeeProfile(email);
      if (!employee) {
        await supabase.auth.signOut();
        return { success: false, message: 'Employee profile not found in database.' };
      }

      localStorage.setItem('quantum_token', data.session.access_token);
      localStorage.setItem('quantum_user', JSON.stringify(employee));
      if (mountedRef.current) {
        setToken(data.session.access_token);
        setUser(employee);
        setIsAuthenticated(true);
      }

      return { success: true };
    } catch (err) {
      console.error('[LOGIN ERROR]:', err);
      return { success: false, message: err.message || 'Login failed due to a network error' };
    }
  };

  const handleRegister = async (profileData) => {
    try {
      return await apiCall('/employees', 'POST', profileData, token);
    } catch (err) {
      return { success: false, message: err.message || 'Failed to register employee' };
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('quantum_token');
    localStorage.removeItem('quantum_user');
    if (mountedRef.current) {
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
    }
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, loading, login: handleLogin, register: handleRegister, logout: handleLogout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
