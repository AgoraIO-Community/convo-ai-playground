import path from "node:path";
import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    clearMocks: true,
    exclude: [
      ...configDefaults.exclude,
      ".worktrees/**",
      "agent-studio-backend/**",
      "agora-demo/**",
      "mcp-knowledge-base/**",
    ],
  },
});
