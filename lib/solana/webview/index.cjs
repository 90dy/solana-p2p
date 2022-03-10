try {
  /** @type {SolanaState} */
  var state = {};

  /** @type {solanaWeb3.Connection | undefined} */
  var connection;
  /** @type {solanaWeb3.Keypair} */
  var keypair;

  /**
   * @param {SolanaAction} action
   */
  function nativeDispatch(action) {
    // @ts-ignore
    window.ReactNativeWebView.postMessage(JSON.stringify({ action: action }));
  }

  /**
   * @param {SolanaAction} action
   * @returns {Promise<void>}
   */
  async function webDispatch(action) {
    const conn = state?.connection;
    const account = state?.connection?.data?.account;
    const tokenList = state?.connection?.data?.account?.data?.tokenList;
    // webDispatch handle actions
    switch (action.type) {
      case "CONNECT":
        try {
          if (conn?.loading) return;
          const { Connection, clusterApiUrl } = solanaWeb3;
          connection = new Connection(clusterApiUrl(action.payload.cluster), "confirmed");
          nativeDispatch({ type: "CONNECT_SUCCESS" });
        } catch (error) {
          if (error instanceof Error) nativeDispatch({ type: "CONNECT_ERROR", payload: { message: error.message } });
        } finally {
          break;
        }

      case "ACCOUNT_GET":
        try {
          // checking state
          if (account?.loading) return;
          if (!connection) throw new Error("WebView: Connection not established");
          const { secretKey } = action.payload;
          const { Keypair, LAMPORTS_PER_SOL } = solanaWeb3;
          if (!secretKey) {
            keypair = Keypair.generate();
            const airdropSignature = await connection.requestAirdrop(keypair.publicKey, LAMPORTS_PER_SOL);
            await connection.confirmTransaction(airdropSignature);
            nativeDispatch({
              type: "ACCOUNT_GET_SUCCESS",
              payload: {
                publicKey: keypair.publicKey,
                secretKey: Object.values(keypair.secretKey),
              },
            });
          } else {
            try {
              keypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));
              nativeDispatch({
                type: "ACCOUNT_GET_SUCCESS",
                payload: {
                  publicKey: keypair.publicKey,
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
            nativeDispatch({ type: "ACCOUNT_GET_ERROR", payload: { message: error.message } });
        } finally {
          break;
        }

      case "TOKEN_ADD":
        try {
          // checking state
          if (tokenList?.loading) return;
          if (!connection) throw new Error("WebView: Connection not established");
          if (!keypair) throw new Error("WebView: Authentication required");
          console.log("solanaWeb3", solanaWeb3);
          console.log("solanaSplToken", solanaSplToken);
          const mint = await solanaSplToken.createMint(connection, keypair, keypair.publicKey, keypair.publicKey, 9);
          const tokenAccount = await solanaSplToken.getOrCreateAssociatedTokenAccount(
            connection,
            keypair,
            mint,
            keypair.publicKey
          );
          const amount = Math.floor(Math.random() * 1000);
          await solanaSplToken.mintTo(connection, keypair, mint, tokenAccount.address, keypair.publicKey, amount);
          const mintInfo = await solanaSplToken.getMint(connection, mint);
          const tokenAccountInfo = await solanaSplToken.getAccount(connection, tokenAccount.address);
          nativeDispatch({
            type: "TOKEN_ADD_SUCCESS",
            payload: {
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
            },
          });
        } catch (error) {
          console.error(error);
          if (error instanceof Error) nativeDispatch({ type: "TOKEN_ADD_ERROR", payload: { message: error.message } });
        } finally {
          break;
        }

      case "TOKEN_LIST":
        nativeDispatch({ type: "TOKEN_LIST_ERROR", payload: { message: "not implemented" } });
        break;

      default:
        break;
    }
  }
} catch (error) {
  console.error(error);
  if (error instanceof Error) alert(error.message);
}
