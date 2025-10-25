import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Create a placeholder client if environment variables are missing (for build time)
const createSupabaseClient = () => {
  if (!supabaseUrl || !supabaseKey) {
    console.warn(
      "Supabase environment variables are missing. Using placeholder client."
    );
    // Return a placeholder client for build time
    return createClient("https://placeholder.supabase.co", "placeholder-key", {
      auth: {
        persistSession: false,
      },
    });
  }

  return createClient(supabaseUrl, supabaseKey);
};

export const supabase = createSupabaseClient();

// Check if we have real credentials
export const hasSupabaseCredentials = !!(
  supabaseUrl &&
  supabaseKey &&
  supabaseUrl !== "https://placeholder.supabase.co"
);

// Auth helpers
export const auth = {
  signUp: async (email: string, password: string) => {
    if (!hasSupabaseCredentials) {
      return {
        data: null,
        error: { message: "Supabase credentials not configured" },
      };
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    return { data, error };
  },

  signIn: async (email: string, password: string) => {
    if (!hasSupabaseCredentials) {
      return {
        data: null,
        error: { message: "Supabase credentials not configured" },
      };
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  },

  signOut: async () => {
    if (!hasSupabaseCredentials) {
      return { error: { message: "Supabase credentials not configured" } };
    }
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  getUser: async () => {
    if (!hasSupabaseCredentials) {
      return {
        user: null,
        error: { message: "Supabase credentials not configured" },
      };
    }
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    return { user, error };
  },

  getSession: async () => {
    if (!hasSupabaseCredentials) {
      return {
        session: null,
        error: { message: "Supabase credentials not configured" },
      };
    }
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    return { session, error };
  },
};

// Database helpers
export const db = {
  // Generic select
  select: <T>(table: string) => supabase.from(table).select<"*", T>(),

  // Generic insert
  insert: <T>(table: string, data: Partial<T>) =>
    supabase.from(table).insert(data),

  // Generic update
  update: <T>(table: string, data: Partial<T>) =>
    supabase.from(table).update(data),

  // Generic delete
  delete: (table: string) => supabase.from(table).delete(),
};
