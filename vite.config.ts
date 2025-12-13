
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Only enable custom HMR/allowedHosts when deploying behind a reverse proxy.
// For local development, keep Vite defaults to prevent reconnect loops.
export default defineConfig(() => {
  const hmrHost = process.env.HMR_HOST?.trim();
  const useProxy = Boolean(hmrHost);
  // Default to secure websocket when a proxy host is provided (typical HTTPS fronting)
  const hmrProtocol = (process.env.HMR_PROTOCOL || 'wss') as 'ws' | 'wss';
  const hmrPort = Number(process.env.HMR_PORT || (hmrProtocol === 'wss' ? 443 : 80));

  const server: any = {
    host: true,
    port: 5173,
    strictPort: true,
    // Allow production host to avoid Vite's dev-server host check when proxied
    allowedHosts: ["recorder.artynew.com"],
  };

  if (useProxy) {
    server.allowedHosts = ["recorder.artynew.com", hmrHost];
    server.hmr = { host: hmrHost, clientPort: hmrPort, protocol: hmrProtocol };
  }

  return {
    plugins: [react()],
    server,
  };
});
    
