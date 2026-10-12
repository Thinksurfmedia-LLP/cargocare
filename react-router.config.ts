import type { Config } from "@react-router/dev/config";

export default {
  // Config options...
  // Server-side render by default, to enable SPA mode set this to `false`
  ssr: true,
  future: {
    // Needed for the sitewide maintenance gate in root.tsx (runs before every loader/action).
    unstable_middleware: true,
  },
} satisfies Config;
