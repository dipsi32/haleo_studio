// Which sign-in methods this backend has switched on (Google, email), read
// from Supabase's public auth settings, so a sign-in button is only offered
// when it will work. Google turns on when Bootstrap has the OAuth client.
import { useEffect, useState } from "react";

export type Providers = { google: boolean; email: boolean; loaded: boolean };

let cache: Promise<Providers> | null = null;

const read = (): Promise<Providers> =>
  (cache ??= (async () => {
    try {
      const url = import.meta.env.VITE_SUPABASE_URL as string;
      const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
      const d = (await res.json()) as { external?: Record<string, boolean> };
      return { google: !!d.external?.google, email: d.external?.email !== false, loaded: true };
    } catch {
      return { google: false, email: true, loaded: true };
    }
  })());

export const useAuthProviders = (): Providers => {
  const [p, setP] = useState<Providers>({ google: false, email: true, loaded: false });
  useEffect(() => {
    let alive = true;
    read().then((v) => alive && setP(v));
    return () => {
      alive = false;
    };
  }, []);
  return p;
};
