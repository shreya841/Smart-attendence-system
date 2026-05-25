import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder').replace('anon public ', '').trim();

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // Persist session in localStorage so refresh hydrates instantly
    persistSession: true,
    // Auto-refresh the token before it expires
    autoRefreshToken: true,
    // Don't detect session from URL (we use localStorage only)
    detectSessionInUrl: false,
    // Store keys with stable prefix
    storageKey: 'quantum-guard-auth',
  }
});
