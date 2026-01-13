import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // If the file is inside node_modules, put it in a 'vendor' chunk
          if (id.includes("node_modules")) {
            return "vendor";
          }
        },
      },
    },
    // Optional: Increase the warning limit if you really can't reduce it further
    chunkSizeWarningLimit: 10000,
  },
});
