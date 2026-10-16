import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// https://vitejs.dev/config/
// A staging build must never talk to the production backend.
const PRODUCTION_PROJECT_REF = "nfjipxgmwdlxqzzvqmsl";
const assertStagingIsNotProduction = (mode: string) => {
  if (mode !== "staging") return;
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const url = env.VITE_SUPABASE_URL ?? "";
  if (!url) throw new Error("Staging build needs VITE_SUPABASE_URL (see .env.staging.example).");
  if (url.includes(PRODUCTION_PROJECT_REF) || env.VITE_SUPABASE_PROJECT_ID === PRODUCTION_PROJECT_REF) {
    throw new Error("Refusing a staging build that points at the production Supabase project.");
  }
};

export default defineConfig(({ mode }) => {
  assertStagingIsNotProduction(mode);
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
