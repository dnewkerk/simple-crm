import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        // Bind to all interfaces (0.0.0.0 / ::) so VS Code devcontainer port
        // forwarding — which connects over IPv4 127.0.0.1 — can reach the dev
        // server. The default `localhost` bind resolves to ::1 only in this
        // container, so IPv4 connections to the forwarded port are refused.
        host: true,
        proxy: {
            "/api": {
                target: "http://localhost:3000",
                changeOrigin: true,
                rewrite: path => path.replace(/^\/api/, ""),
            },
        },
    },
});
