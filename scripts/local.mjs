import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const python =
  process.platform === "win32"
    ? path.join(root, ".venv/Scripts/python.exe")
    : path.join(root, ".venv/bin/python");
if (!fs.existsSync(python)) {
  console.error(
    "Install the local sidecar first: python3 -m venv .venv && .venv/bin/python -m pip install -r server/requirements.txt",
  );
  process.exit(1);
}
const children = [];
let ending = false;
function stop(code = 0) {
  if (ending) return;
  ending = true;
  for (const child of children) child.kill("SIGTERM");
  process.exitCode = code;
}
for (const [binary, args] of [
  [
    python,
    [
      "-m",
      "uvicorn",
      "server.app:app",
      "--host",
      "127.0.0.1",
      "--port",
      (process.env.ATMEM_ARCHITECT_SIDECAR_PORT || process.env.ATFORMA_SIDECAR_PORT) || "8766",
      "--no-access-log",
    ],
  ],
  [process.execPath, ["node_modules/vite/bin/vite.js"]],
]) {
  const child = spawn(binary, args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  children.push(child);
  child.on("exit", (code) => stop(code || 0));
  child.on("error", (error) => {
    console.error(error.message);
    stop(1);
  });
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
