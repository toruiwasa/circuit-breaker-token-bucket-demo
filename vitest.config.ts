import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "url";
import { existsSync } from "fs";
import { homedir } from "os";

// Resolve Docker socket before testcontainers initializes.
// Covers Colima (~/.colima/default), Docker Desktop (~/.docker/run),
// and standard (/var/run/docker.sock) locations.
// On Colima, TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE is also required so
// testcontainers mounts /var/run/docker.sock (valid inside the VM) instead
// of the macOS host socket path.
if (!process.env.DOCKER_HOST) {
  const candidates: Array<{ host: string; socketOverride?: string }> = [
    {
      host: `${homedir()}/.colima/default/docker.sock`,
      socketOverride: "/var/run/docker.sock",
    },
    { host: `${homedir()}/.docker/run/docker.sock` },
    { host: `${homedir()}/.docker/desktop/docker.sock` },
    { host: "/var/run/docker.sock" },
  ];
  for (const { host, socketOverride } of candidates) {
    if (existsSync(host)) {
      process.env.DOCKER_HOST = `unix://${host}`;
      if (socketOverride && !process.env.TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE) {
        process.env.TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE = socketOverride;
      }
      break;
    }
  }
}

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: "./vitest.global-setup.ts",
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
