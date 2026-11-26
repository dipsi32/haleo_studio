import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// https://vitejs.dev/config/
// Dev and demo builds must never talk to the production backend.
// VITE_APP_ENV is set by the deploy pipeline (deploy/<env>.env, APP_ENV).
const PRODUCTION_PROJECT_REF = "rpvetitrrdfycvoyxept";
const assertNotProductionBackend = (mode: string) => {
  const env = { ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env };
  const appEnv = env.VITE_APP_ENV ?? "";
  if (!appEnv || appEnv === "production") return;
  const url = env.VITE_SUPABASE_URL ?? "";
  if (!url) throw new Error(`A ${appEnv} build needs VITE_SUPABASE_URL (deploy/${appEnv}.env).`);
  if (url.includes(PRODUCTION_PROJECT_REF) || env.VITE_SUPABASE_PROJECT_ID === PRODUCTION_PROJECT_REF) {
    throw new Error(`Refusing a ${appEnv} build that points at the production Supabase project.`);
  }
};

export default defineConfig(({ mode }) => {
  assertNotProductionBackend(mode);
  return {
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mcpPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
};
});
