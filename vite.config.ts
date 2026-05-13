import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

function apiMockPlugin() {
  return {
    name: "api-mock",
    configureServer(server: any) {
      server.middlewares.use("/api/registrations", (req: any, res: any, next: any) => {
        if (req.method !== "POST") return next();
        let body = "";
        req.on("data", (c: Buffer) => (body += c));
        req.on("end", () => {
          const id = "REG-" + Math.random().toString(36).slice(2, 10).toUpperCase();
          res.setHeader("Content-Type", "application/json");
          res.statusCode = 200;
          res.end(JSON.stringify({ ok: true, registration: { id } }));
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), apiMockPlugin()],
  resolve: {
    alias: {
      "@assets": path.resolve(__dirname, "attached_assets"),
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
    hmr: { clientPort: 443 },
  },
});
