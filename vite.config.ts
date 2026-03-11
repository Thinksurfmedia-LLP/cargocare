import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: {
    host: true, // expose on all network interfaces (0.0.0.0)
  },
  plugins: [
    tsconfigPaths(),
    tailwindcss(),
    reactRouter(),
  ],
  optimizeDeps: {
    exclude: [
      "nodemailer",
      "node-cron",
      "@types/nodemailer",
      "@types/node-cron"
    ],
  },
  ssr: {
    external: ["nodemailer", "node-cron"],
  },
  resolve: {
    alias: {
      "~": "/app",
    },
  },
});
