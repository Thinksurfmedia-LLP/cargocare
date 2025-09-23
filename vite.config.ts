import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
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
});
