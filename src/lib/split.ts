// The dev/test split rule, as in cmeval.tasks.assign_split. tests/truth.test.ts checks it
// against the real function from codemem.
import { sha256 } from "./sha256";

export const SPLIT_SEED = "cmeval-split-1";
export const DEV_PERCENT = 20;

export type SplitResult = {
  /** The full digest of "<seed>:<task id>". */
  hex: string;
  /** Its first 8 bytes (16 hex digits), read as one big number. */
  first: string;
  big: bigint;
  /** big mod 100. */
  bucket: number;
  split: "dev" | "test";
};

export function splitOf(taskId: string, seed = SPLIT_SEED, devPercent = DEV_PERCENT): SplitResult {
  const hex = sha256(`${seed}:${taskId}`);
  const first = hex.slice(0, 16);
  const big = BigInt(`0x${first}`);
  const bucket = Number(big % 100n);
  return { hex, first, big, bucket, split: bucket < devPercent ? "dev" : "test" };
}
