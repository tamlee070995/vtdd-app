import { rm } from "node:fs/promises";
import path from "node:path";

const devCachePath = path.join(process.cwd(), ".next", "dev");

await rm(devCachePath, { recursive: true, force: true });
