import { ISolana } from "./../../hooks/useSolana";
export * as solanaWeb3 from "@solana/web3.js";
export * from "../hooks/useSolana";

declare global {
  export * as solanaWeb3 from "@solana/web3.js";
  export { SolanaMessage, SolanaState } from "../hooks/useSolana";
}
