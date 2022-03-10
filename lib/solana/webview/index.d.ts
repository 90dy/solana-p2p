import { ISolana } from "..";
export * as solanaWeb3 from "@solana/web3.js";
export * as solanaSplToken from "@solana/spl-token";
export * from "../hooks/useSolana";

export function encode(bytes: Uint8Array): string;
export function decode(base64: string): Uint8Array;

declare global {
  export * as solanaWeb3 from "@solana/web3.js";
  export * as solanaSplToken from "@solana/spl-token";
  export { SolanaAction, SolanaState } from "../hooks/useSolana";

  export function encode64(bytes: Uint8Array): string;
  export function decode64AsArrayBuffer(base64: string): Uint8Array;
}
