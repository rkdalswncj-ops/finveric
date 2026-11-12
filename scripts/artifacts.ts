import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fromRoot } from "./root.ts";
export const proofKeyHash = () =>
  createHash("sha256")
    .update(readFileSync(fromRoot("circuits/build/suitability.zkey")))
    .digest("hex");
