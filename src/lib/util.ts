/** Wait some seconds. */
export const pause = (s: number): Promise<void> => new Promise((r) => setTimeout(r, s * 1000));
