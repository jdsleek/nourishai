#!/usr/bin/env node
/**
 * Runs HTTP training E2E against `next dev` (default). Picks an ephemeral TCP port automatically.
 */

import { existsSync } from "fs";
import { spawn } from "child_process";
import { createServer } from "net";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FOOD_APP = join(__dirname, "..");
const NEXT_BIN = join(FOOD_APP, "node_modules", ".bin", "next");
const VERIFY_SCRIPT = join(__dirname, "e2e-verify-training-platform.mjs");

async function pickPort() {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const a = s.address();
      resolve(typeof a === "object" && a?.port ? a.port : 3000);
      s.close();
    });
  });
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function tcpReady(port, tries = 150) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/api/foundry/class-hub`, {
        signal: AbortSignal.timeout(3000),
      });
      if (r.status >= 200 && r.status < 600) return;
    } catch {
      /* still compiling */
    }
    await wait(400);
  }
  throw new Error(`Server not ready on 127.0.0.1:${port}`);
}

async function runBuildIfProd() {
  if (process.env.E2E_NEXT_MODE !== "production") return;
  console.log("npm run build …\n");
  const code = await new Promise((resolve) => {
    const p = spawn("npm", ["run", "build"], {
      stdio: "inherit",
      cwd: FOOD_APP,
      shell: true,
    });
    p.on("close", resolve);
  });
  if (code !== 0) process.exit(Number(code) || 1);
}

async function main() {
  if (!existsSync(NEXT_BIN)) {
    console.error(`Missing Next binary at ${NEXT_BIN} — run npm install in food-app/`);
    process.exit(1);
  }

  const port = Number(
    process.env.E2E_PORT || (await pickPort()),
  ).toFixed(0);

  await runBuildIfProd();

  const prod = process.env.E2E_NEXT_MODE === "production";
  const args = prod
    ? ["start", "-H", "127.0.0.1", "-p", port]
    : ["dev", "-H", "127.0.0.1", "-p", port];

  console.log(`${prod ? "next start" : "next dev"} 127.0.0.1:${port}\n`);

  const logErr = [];
  const logOut = [];
  const server = spawn(NEXT_BIN, args, {
    cwd: FOOD_APP,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: port },
    shell: false,
  });

  server.stderr?.on("data", (d) => logErr.push(d.toString()));
  server.stdout?.on("data", (d) => logOut.push(d.toString()));

  try {
    await tcpReady(port);
    const url = `http://127.0.0.1:${port}`;

    console.log(`Running verify → ${url}\n`);

    const codeVerify = await new Promise((resolve) => {
      const v = spawn(process.execPath, [VERIFY_SCRIPT], {
        stdio: "inherit",
        cwd: FOOD_APP,
        env: { ...process.env, E2E_BASE_URL: url },
      });
      v.on("close", resolve);
    });

    process.exit(Number(codeVerify) || 0);
  } catch (e) {
    console.error(e.message || e);
    const tailErr = logErr.slice(-8).join("");
    const tailOut = logOut.slice(-8).join("");
    if (tailErr) console.error("[next stderr]\n", tailErr.slice(-4000));
    if (tailOut) console.error("[next stdout]\n", tailOut.slice(-2000));
    process.exit(1);
  } finally {
    server.kill("SIGTERM");
    await wait(800);
    try {
      server.kill("SIGKILL");
    } catch {
      /* ignored */
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
