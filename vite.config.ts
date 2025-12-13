
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Only enable custom HMR/allowedHosts when deploying behind a reverse proxy.
// For local development, keep Vite defaults to prevent reconnect loops.
export default defineConfig(() => {
  const hmrHost = "recorder.artynew.com";
  const useProxy = Boolean(hmrHost);
  // Default to secure websocket when a proxy host is provided (typical HTTPS fronting)
  const hmrProtocol = (process.env.HMR_PROTOCOL || 'wss') as 'ws' | 'wss';
  const hmrPort = Number(process.env.HMR_PORT || (hmrProtocol === 'wss' ? 443 : 80));

  const server: any = {
    host: true,
    port: 5173,
    strictPort: true,
  };

  if (useProxy) {
    server.allowedHosts = [hmrHost];
    server.hmr = { host: hmrHost, clientPort: hmrPort, protocol: hmrProtocol };
  }

  return {
    plugins: [react()],
    server,
  };
});
    
