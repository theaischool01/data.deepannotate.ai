import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const SESSION_TOKEN_KEY = "app_session_jwt";

let currentToken: string | null = null;

/** Updates the active JWT used for authorizing direct Supabase PostgreSQL and Storage requests and persists it in localStorage. */
export function setSupabaseToken(token: string | null) {
  currentToken = token;
  if (typeof window !== "undefined" && window.localStorage) {
    if (token) {
      localStorage.setItem(SESSION_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(SESSION_TOKEN_KEY);
    }
  }
}

/** Retrieves the persisted session token from localStorage if present. */
export function getStoredSupabaseToken(): string | null {
  if (typeof window !== "undefined" && window.localStorage) {
    return localStorage.getItem(SESSION_TOKEN_KEY);
  }
  return null;
}

/** Safely parses the payload of a JWT. */
export function parseJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

/** Validates whether a token string is a valid non-expired session JWT. */
export function isJwtValid(token: string | null): boolean {
  if (!token) return false;
  const payload = parseJwtPayload(token);
  if (!payload) return false;
  if (payload.purpose !== 'session') return false;
  if (typeof payload.exp !== 'number') return false;
  // Expiration check with a 30-second buffer
  return payload.exp * 1000 > Date.now() + 30000;
}

const customFetch = async (url: any, options: any = {}) => {
  const headers = new Headers(options.headers);
  
  // Ensure the project's apikey header is always present
  if (SUPABASE_PUBLISHABLE_KEY && !headers.has("apikey")) {
    headers.set("apikey", SUPABASE_PUBLISHABLE_KEY);
  }

  // Inject or override the authorization bearer token
  if (currentToken) {
    headers.set("Authorization", `Bearer ${currentToken}`);
  } else if (SUPABASE_PUBLISHABLE_KEY && !headers.has("Authorization")) {
    // Fall back to the public anon token if no custom authenticated token is present
    headers.set("Authorization", `Bearer ${SUPABASE_PUBLISHABLE_KEY}`);
  }

  return fetch(url, { ...options, headers });
};

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    fetch: customFetch,
  },
});