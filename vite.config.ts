
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Only enable custom HMR/allowedHosts when deploying behind>// For local development, keep Vite defaults to prevent reco>export default defineConfig(() => {
  const hmrHost = process.env.HMR_HOST?.trim();
  const useProxy = Boolean(hmrHost);
  // Default to secure websocket when a proxy host is provid>  const hmrProtocol = (process.env.HMR_PROTOCOL || 'wss') as>  const hmrPort = Number(process.env.HMR_PORT || (hmrProtoco>

  const server: any = {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: ["recorder.artynew.com"],
  };

  if (useProxy) {
    server.allowedHosts = [hmrHost];
    server.hmr = { host: hmrHost, clientPort: hmrPort, proto>
  }

  return {
    plugins: [react()],
    server,
  };
});
    
