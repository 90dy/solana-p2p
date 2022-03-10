import type { SolanaState, SolanaAction } from ".";
import * as Web3 from "@solana/web3.js";
import * as SplToken from "@solana/spl-token";
var state: SolanaState = {};

// TODO: add tests

var connection: Web3.Connection | undefined;
var keypair: Web3.Keypair;

export function nativeDispatch(action: SolanaAction) {
  // @ts-ignore
  window.ReactNativeWebView.postMessage(JSON.stringify({ action: action }));
}

async function getTokenPayload(connection: Web3.Connection, tokenAccountAddress: Web3.PublicKey) {
  const tokenAccountInfo = await SplToken.getAccount(connection, tokenAccountAddress);
  const mintInfo = await SplToken.getMint(connection, tokenAccountInfo.mint);
  return {
    mint: {
      address: mintInfo.address.toBase58(),
      decimals: mintInfo.decimals,
      freezeAuthority: mintInfo.freezeAuthority?.toBase58(),
      isInitialized: mintInfo.isInitialized,
      mintAuthority: mintInfo.mintAuthority?.toBase58(),
      supply: mintInfo.supply.toString(),
    },
    account: {
      address: tokenAccountInfo.address.toBase58(),
      amount: tokenAccountInfo.amount.toString(),
      closeAuthority: tokenAccountInfo.closeAuthority?.toBase58(),
      delegate: tokenAccountInfo.delegate?.toBase58(),
      delegatedAmount: tokenAccountInfo.delegatedAmount.toString(),
      isFrozen: tokenAccountInfo.isFrozen,
      isInitialized: tokenAccountInfo.isInitialized,
      isNative: tokenAccountInfo.isNative,
      mint: tokenAccountInfo.mint.toBase58(),
      owner: tokenAccountInfo.owner.toBase58(),
    },
  };
}

export async function webDispatch(action: SolanaAction): Promise<void> {
  const conn = state?.connection;
  const account = state?.connection?.data?.account;
  const tokenList = state?.connection?.data?.account?.data?.tokenList;
  // webDispatch handle actions
  switch (action.type) {
    case "CONNECT":
      try {
        if (conn?.loading) return;
        const { Connection, clusterApiUrl } = Web3;
        connection = new Connection(clusterApiUrl(action.payload.cluster), "confirmed");
        nativeDispatch({ type: "CONNECT_SUCCESS", payload: undefined });
      } catch (error) {
        if (error instanceof Error)
          nativeDispatch({ type: "CONNECT_ERROR", payload: { message: error.message, stack: error.stack } });
      } finally {
        break;
      }

    case "ACCOUNT_GET":
      try {
        // checking state
        if (account?.loading) return;
        if (!connection) throw new Error("WebView: Connection not established");
        const { secretKey } = action.payload;
        const { Keypair, LAMPORTS_PER_SOL } = Web3;
        if (!secretKey) {
          keypair = Keypair.generate();
          const airdropSignature = await connection.requestAirdrop(keypair.publicKey, LAMPORTS_PER_SOL);
          await connection.confirmTransaction(airdropSignature);
          nativeDispatch({
            type: "ACCOUNT_GET_SUCCESS",
            payload: {
              publicKey: keypair.publicKey.toBase58(),
              secretKey: Object.values(keypair.secretKey),
            },
          });
        } else {
          try {
            keypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));
            nativeDispatch({
              type: "ACCOUNT_GET_SUCCESS",
              payload: {
                publicKey: keypair.publicKey.toBase58(),
                secretKey: Object.values(keypair.secretKey),
              },
            });
          } catch (error) {
            // reinit account
            if (confirm("SecretKey corrupted, recreate an account ?"))
              return webDispatch({ type: "ACCOUNT_GET", payload: {} });
            throw error;
          }
        }
      } catch (error) {
        console.error(error);
        if (error instanceof Error)
          nativeDispatch({ type: "ACCOUNT_GET_ERROR", payload: { message: error.message, stack: error.stack } });
      } finally {
        break;
      }

    case "TOKEN_ADD":
      try {
        // checking state
        if (tokenList?.loading) return;
        if (!connection) throw new Error("WebView: Connection not established");
        if (!keypair) throw new Error("WebView: Authentication required");

        const mint = await SplToken.createMint(connection, keypair, keypair.publicKey, keypair.publicKey, 9);
        const tokenAccount = await SplToken.getOrCreateAssociatedTokenAccount(
          connection,
          keypair,
          mint,
          keypair.publicKey
        );
        const amount = Math.floor(Math.random() * 1000);
        await SplToken.mintTo(connection, keypair, mint, tokenAccount.address, keypair.publicKey, amount);
        nativeDispatch({
          type: "TOKEN_ADD_SUCCESS",
          payload: await getTokenPayload(connection, tokenAccount.address),
        });
      } catch (error) {
        console.error(error);
        if (error instanceof Error)
          nativeDispatch({ type: "TOKEN_ADD_ERROR", payload: { message: error.message, stack: error.stack } });
      } finally {
        break;
      }

    case "TOKEN_LIST":
      try {
        if (!connection) throw new Error("WebView: Connection not established");
        if (!keypair) throw new Error("WebView: Authentication required");

        const tokenAccounts = await connection.getTokenAccountsByOwner(keypair.publicKey, {
          programId: SplToken.TOKEN_PROGRAM_ID,
        });
        nativeDispatch({
          type: "TOKEN_LIST_SUCCESS",
          payload: await Promise.all(
            tokenAccounts.value.map((value) => getTokenPayload(connection as Web3.Connection, value.pubkey))
          ),
        });
      } catch (error) {
        console.error(error);
        if (error instanceof Error)
          nativeDispatch({ type: "TOKEN_LIST_ERROR", payload: { message: error.message, stack: error.stack } });
      } finally {
        break;
      }

    default:
      break;
  }
}
