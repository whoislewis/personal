declare module 'culori' {
  export function interpolate(colors: string[], mode: string): (t: number) => unknown;
  export function formatHex(color: unknown): string | undefined;
}
