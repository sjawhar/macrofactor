declare module 'fs' {
  export function readFileSync(path: string, encoding: string): string;
}

declare module 'crypto' {
  export function randomUUID(): string;
}

declare const process: any;
