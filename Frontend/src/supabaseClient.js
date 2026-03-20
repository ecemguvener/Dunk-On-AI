import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const missingEnvMessage =
  'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Frontend/.env.';

// A safe fallback client so the app can render even when env vars are missing.
const disabledResult = { data: [], error: { message: missingEnvMessage } };
const disabledQuery = new Proxy(
  {},
  {
    get(_, prop) {
      if (prop === 'then') {
        return (resolve) => resolve(disabledResult);
      }
      return () => disabledQuery;
    },
  }
);

const disabledClient = {
  from: () => disabledQuery,
  auth: {
    getUser: async () => ({ data: { user: null }, error: { message: missingEnvMessage } }),
  },
};

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(missingEnvMessage);
}

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : disabledClient;
