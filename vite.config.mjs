import { defineConfig } from "vite";
export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: Number(process.env.ATFORMA_PORT || 5174),
    strictPort: true,
    proxy: { "/api": { target: `http://127.0.0.1:${process.env.ATFORMA_SIDECAR_PORT || 8766}`, changeOrigin: false } },
  },
  preview: { host: "127.0.0.1", port: 4174, strictPort: true },
});
