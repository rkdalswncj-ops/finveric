import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
export function foundryBinary(tool) {
  const platform = process.platform === "win32" ? "win32" : process.platform;
  const architecture = process.arch === "x64" ? "amd64" : process.arch;
  const suffix = platform === "win32" ? ".exe" : "";
  return require.resolve(
    `@foundry-rs/${tool}-${platform}-${architecture}/bin/${tool}${suffix}`,
  );
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const child = spawn(foundryBinary(process.argv[2]), process.argv.slice(3), {
    stdio: "inherit",
  });
  child.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
}
