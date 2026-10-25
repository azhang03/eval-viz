// Reading pace (viz decision 23): a caption or a step stays long enough to read.

/** Seconds to read a short text: 2 s plus 0.03 s for each character. HTML tags do not count. */
export function readTime(html: string): number {
  return 2.0 + html.replace(/<[^>]+>/g, "").length * 0.03;
}

/** True if the user asked the system for less motion. Lines then wait for a click. */
export function reducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
