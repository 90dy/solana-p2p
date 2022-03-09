(async function () {
  alert("1");

  /** @type {solanaWeb3.Connection | undefined} */
  var connection;

  /**
   * @param {SolanaAction} action
   */
  function nativeDispatch(action) {
    // @ts-ignore
    window.ReactNativeWebView.post(JSON.stringify(action));
  }

  /** @param {SolanaAction} action */
  function dispatch(action) {
    webDispatch(action);
    nativeDispatch(action);
  }

  /** @param {SolanaAction} action */
  async function webDispatch(action) {
    switch (action.type) {
      case "CONNECT":
        try {
          const { Connection, clusterApiUrl } = solanaWeb3;
          connection = new Connection(clusterApiUrl(action.payload.cluster), "confirmed");
          nativeDispatch({ type: "CONNECT_SUCCESS" });
        } catch (error) {
          if (error instanceof Error) nativeDispatch({ type: "CONNECT_ERROR", payload: { message: error.message } });
        } finally {
          return;
        }

      case "ACCOUNT_GET":
        try {
          if (!connection) throw new Error("WebView: Connection not established");
          const { secretKey } = action.payload;
          const { Keypair, LAMPORTS_PER_SOL } = solanaWeb3;
          if (!secretKey) {
            const payer = Keypair.generate();
            const airdropSignature = await connection.requestAirdrop(payer.publicKey, LAMPORTS_PER_SOL);
            await connection.confirmTransaction(airdropSignature);
            nativeDispatch({ type: "ACCOUNT_GET_SUCCESS", payload: { keypair: payer } });
          } else {
            nativeDispatch({
              type: "ACCOUNT_GET_ERROR",
              payload: { keypair: Keypair.fromSecretKey(new TextEncoder().encode(secretKey)) },
            });
          }
        } catch (error) {
          if (error instanceof Error)
            nativeDispatch({ type: "ACCOUNT_GET_ERROR", payload: { message: error.message } });
        } finally {
          return;
        }

      case "TOKEN_LIST":
        nativeDispatch({
          type: "TOKEN_LIST_ERROR",
          payload: { message: "WebView: action TOKEN_LIST not implemented" },
        });
        return;

      default:
        return;
    }
  }
})();
