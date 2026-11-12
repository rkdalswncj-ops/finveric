import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { ZK_FILES, zkPath } from "./root.ts";

/** 증명 키(zkey)의 sha256. 배포 설정의 proofKeyHash와 같아야 한다. */
export const proofKeyHash = () =>
  createHash("sha256")
    .update(readFileSync(zkPath(ZK_FILES.zkey)))
    .digest("hex");
