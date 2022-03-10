try {
  /** @type {SolanaState} */
  var state = {};

  /** @type {solanaWeb3.Connection | undefined} */
  var connection;

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
    // webDispatch handle actions
    switch (action.type) {
      case "CONNECT":
        try {
          const conn = state?.connection;
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
          const account = state?.connection?.data?.account;
          if (account?.loading) return;
          nativeDispatch(account);
          if (!connection) throw new Error("WebView: Connection not established");
          const { secretKey } = action.payload;
          const { Keypair, LAMPORTS_PER_SOL } = solanaWeb3;
          if (!secretKey) {
            const keypair = Keypair.generate();
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
              const keypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));
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

      case "TOKEN_LIST":
        nativeDispatch({
          type: "TOKEN_LIST_ERROR",
          payload: { message: "WebView: action TOKEN_LIST not implemented" },
        });
        break;

      default:
        break;
    }
  }
} catch (error) {
  console.error(error);
  if (error instanceof Error) alert(error.message);
}
