/** Wait some seconds. */
export const pause = (s: number): Promise<void> => new Promise((r) => setTimeout(r, s * 1000));

/** Whole seconds from one ISO 8601 time to another. */
export const secondsBetween = (a: string, b: string): number => Math.round((Date.parse(b) - Date.parse(a)) / 1000);
