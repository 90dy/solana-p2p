import type * as Web3 from "@solana/web3.js";
import type * as SplToken from "@solana/spl-token";
import {
  createContext,
  Dispatch,
  PropsWithChildren,
  Reducer,
  RefObject,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import WebView from "react-native-webview";
import { useAssets } from "expo-asset";
import * as FileSystem from "expo-file-system";
import { View } from "react-native";
import { debounce } from "throttle-debounce";

type JSONValue = undefined | null | string | number | boolean | JSONObject | JSONArray;

interface JSONObject {
  [x: string]: JSONValue;
}

interface JSONArray extends Array<JSONValue> {}

type Payload<T extends JSONValue = JSONValue> = T;

type AsyncAction<
  Type extends string,
  Args extends Payload | undefined = undefined,
  Result extends Payload | undefined = undefined
> =
  | ({ type: Type } & (Args extends undefined ? { payload?: Args } : { payload: Args }))
  | { type: `${Type}_ERROR`; payload: Payload<{ message: string; stack?: string }> }
  | { type: `${Type}_SUCCESS`; payload: Result };

// Models
type SolanaToken = {
  mint: {
    address: string;
    decimals: number;
    freezeAuthority?: string;
    isInitialized: boolean;
    mintAuthority?: string;
    supply: string;
  };
  account: {
    address: string;
    amount: string;
    closeAuthority?: string;
    delegate?: string;
    delegatedAmount: string;
    isFrozen: boolean;
    isInitialized: boolean;
    isNative: boolean;
    mint: string;
    owner: string;
  };
};
type SolanaAccount = {
  publicKey: string;
  secretKey: number[];
};
type SolanaConn = {
  cluster: Web3.Cluster;
};

// Actions

export type SolanaConnectAction = AsyncAction<"CONNECT", SolanaConn>;

export type SolanaAccountAction = AsyncAction<"ACCOUNT_GET", Partial<SolanaAccount>, SolanaAccount>;

export type SolanaTokenAction =
  | AsyncAction<"TOKEN_LIST", undefined, SolanaToken[]>
  | AsyncAction<"TOKEN_ADD", undefined, SolanaToken>;

export type SolanaAction = SolanaConnectAction | SolanaAccountAction | SolanaTokenAction;

// States

export type AsyncState<T> = {
  error?: Error;
  loading?: boolean;
  success?: boolean;
  data?: T;
};

export type SolanaTokenListState = AsyncState<SolanaToken[]>;
export type SolanaAccountState = AsyncState<
  SolanaAccount & {
    tokenList?: SolanaTokenListState;
  }
>;
export type SolanaConnectionState = AsyncState<{
  account?: SolanaAccountState;
}>;
export type SolanaState = {
  connection?: SolanaConnectionState;
};

// Context

type SolanaContext = [SolanaState, Dispatch<SolanaAction>];

const SolanaContext = createContext<SolanaContext>([{}, (action: SolanaAction) => {}]);

// Reducers

const initialState: SolanaState = {};

function reduceLoading<T>(data: T) {
  return {
    loading: true,
    error: undefined,
    success: undefined,
    data,
  };
}
function reduceError<T>(data: T, payload: { message: string }) {
  return {
    loading: false,
    error: new Error(payload?.message),
    success: false,
    data,
  };
}
function reduceSuccess<T>(data: T) {
  return {
    loading: false,
    error: undefined,
    success: true,
    data,
  };
}

function tokenListReducer(state: SolanaTokenListState = {}, action: SolanaAction): SolanaTokenListState {
  switch (action.type) {
    case "TOKEN_LIST":
      return reduceLoading(state.data);
    case "TOKEN_LIST_ERROR":
      return reduceError(state.data, action.payload);
    case "TOKEN_LIST_SUCCESS":
      return reduceSuccess(action.payload);
    case "TOKEN_ADD":
      return reduceLoading(state.data);
    case "TOKEN_ADD_ERROR":
      return reduceError(state.data, action.payload);
    case "TOKEN_ADD_SUCCESS":
      return reduceSuccess([action.payload, ...(state.data ?? [])]);
    default:
      if (!state.success) return state;
      return state;
  }
}

function accountReducer(state: SolanaAccountState = {}, action: SolanaAction): SolanaAccountState {
  switch (action.type) {
    case "ACCOUNT_GET":
      return reduceLoading(state.data);
    case "ACCOUNT_GET_ERROR":
      return reduceError(state.data, action.payload);
    case "ACCOUNT_GET_SUCCESS":
      return reduceSuccess(action.payload);
    default:
      if (!state.data) return state;
      return {
        ...state,
        data: {
          ...state.data,
          tokenList: tokenListReducer(state.data?.tokenList, action),
        },
      };
  }
}

function connectionReducer(state: SolanaConnectionState = {}, action: SolanaAction): SolanaConnectionState {
  switch (action.type) {
    case "CONNECT":
      return reduceLoading(state.data);
    case "CONNECT_ERROR":
      return reduceError(state.data, action.payload);
    case "CONNECT_SUCCESS":
      return reduceSuccess(action.payload);
    default:
      if (!state.success) return state;
      return {
        ...state,
        data: {
          ...state.data,
          account: accountReducer(state.data?.account ?? {}, action),
        },
      };
  }
}

export function SolanaProvider({ children }: PropsWithChildren<unknown>) {
  const [assets, error] = useAssets([require("./webview.html"), require("./webview.cjs")]);
  const webviewHtmlUri = assets?.[0]?.uri;
  const webviewJsPath = assets?.[1]?.localUri;
  const [injectedJavaScript, setInjectedJavaScript] = useState<string>();
  console.log("webviewHtmlUri", webviewHtmlUri);
  console.log("webviewJsPath", webviewJsPath);
  useEffect(() => {
    (async () => {
      if (webviewJsPath) setInjectedJavaScript(await FileSystem.readAsStringAsync(webviewJsPath));
    })();
  }, [webviewJsPath]);

  const webview = useRef<WebView>(null);

  function reducer(state: SolanaState = {}, action: SolanaAction): SolanaState {
    console.log("prevState", state);
    const newState = {
      connection: connectionReducer(state.connection, action),
    };
    console.log("newState", newState);
    return newState;
  }
  const [state, nativeDispatch] = useReducer<Reducer<SolanaState, SolanaAction>>(reducer, initialState);

  const dispatch = debounce(500, function dispatch(action: SolanaAction) {
    console.log("action", action);
    nativeDispatch(action);
    webview.current?.injectJavaScript(`
			webview.state = ${JSON.stringify(state)};
			webview.webDispatch(${JSON.stringify(action)})
		`);
  });

  const [loading, setLoading] = useState(true);

  return (
    <SolanaContext.Provider value={[state, dispatch]}>
      <View style={{ height: 0 }}>
        {webviewHtmlUri && injectedJavaScript && (
          <WebView
            ref={webview}
            source={{ uri: webviewHtmlUri }}
            allowFileAccess
            javaScriptEnabled
            injectedJavaScript={injectedJavaScript}
            onLoadEnd={() => {
              setLoading(false);
            }}
            onMessage={(event) => {
              const message = JSON.parse(event.nativeEvent.data) as
                | { console: { log: JSONArray; error: JSONArray; group: JSONArray; groupEnd: JSONArray } }
                | { action: SolanaAction };
              if ("action" in message) {
                console.log("action", message.action);
                nativeDispatch(message.action);
              }
              if ("console" in message) {
                // @ts-ignore
                Object.entries(message.console).forEach(([key, args]) => console[key]?.(...args));
              }
            }}
          />
        )}
      </View>
      {!loading && children}
    </SolanaContext.Provider>
  );
}

export default function useSolana() {
  return useContext(SolanaContext);
}

export function useConnection(options: SolanaConn = { cluster: "devnet" }): SolanaConnectionState {
  const [state, dispatch] = useSolana();
  const [loading, error, success, data] = [
    state.connection?.loading,
    state.connection?.error,
    state.connection?.success,
    state.connection?.data,
  ];
  const shouldDispatch = !success && !loading && !error;
  useEffect(() => {
    if (!shouldDispatch) return;
    dispatch({ type: "CONNECT", payload: options });
  }, [shouldDispatch]);
  return { data, loading, error, success };
}

export function useAccount(): SolanaAccountState {
  const [, dispatch] = useSolana();
  const conn = useConnection();
  const account = conn?.data?.account;

  const [loading, error, success, data] = [
    account?.loading ?? conn?.loading ?? (!conn?.error && !conn.success),
    account?.error ?? conn?.error,
    account?.success,
    account?.data,
  ];
  const shouldDispatch = !success && !loading && !error;

  const secretKey = conn?.data?.account?.data?.secretKey;
  useEffect(() => {
    if (secretKey) {
      AsyncStorage.setItem("account-secret-key", String.fromCharCode(...secretKey));
    }
  }, [secretKey]);

  const publicKey = conn?.data?.account?.data?.publicKey;
  useEffect(() => {
    if (publicKey) {
      AsyncStorage.setItem("account-public-key", publicKey);
    }
  }, [publicKey]);

  useEffect(() => {
    (async () => {
      if (!shouldDispatch) return;
      const secretKeyStr = await AsyncStorage.getItem("account-secret-key");
      dispatch({
        type: "ACCOUNT_GET",
        payload: {
          secretKey: secretKeyStr ? Array.from(secretKeyStr).map((_) => _.charCodeAt(0)) : undefined,
          publicKey: (await AsyncStorage.getItem("account-public-key")) ?? undefined,
        },
      });
    })();
  }, [shouldDispatch]);
  return { data, loading, error, success };
}

export function useTokenList(): SolanaTokenListState {
  const [, dispatch] = useSolana();
  const account = useAccount();
  const tokenList = account?.data?.tokenList;

  const [loading, error, success, data] = [
    tokenList?.loading ?? account?.loading ?? (!account.error && !account.success),
    tokenList?.error ?? account?.error,
    tokenList?.success,
    tokenList?.data,
  ];
  const shouldDispatch = !success && !loading && !error;

  useEffect(() => {
    if (!shouldDispatch) return;
    dispatch({ type: "TOKEN_LIST" });
  }, [shouldDispatch]);

  return { data, loading, error, success };
}

export function useTokenInfo(address: string): AsyncState<SolanaToken> {
  const tokenList = useTokenList();
  const token = tokenList.data?.find((token) => token.account.address === address);
  const [loading, error, success, data] = [
    tokenList?.loading,
    tokenList?.error ??
      (!token && !tokenList?.loading && !tokenList?.success ? new Error("Token not found") : undefined),
    tokenList?.success,
    token,
  ];
  return { data, loading, error, success };
}
