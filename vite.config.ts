import federation from "@originjs/vite-plugin-federation";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    federation({
      name: "care_io_balance_fe",
      filename: "remoteEntry.js",
      exposes: { "./manifest": "./src/manifest.tsx" },
      shared: ["react", "react-dom", "react-i18next"],
    }),
    react(),
  ],
  build: {
    target: "es2022",
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: {
      input: { main: "./src/index.tsx" },
      output: { format: "esm" },
    },
  },
  preview: { port: 4181, host: "127.0.0.1", cors: true },
});
