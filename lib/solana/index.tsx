import type * as Web3 from "@solana/web3.js";
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
  | { type: Type; payload: Args }
  | { type: `${Type}_ERROR`; payload: Payload<{ message: string }> }
  | { type: `${Type}_SUCCESS`; payload: Result };

// Models

type SolanaToken = {};
type SolanaAccount = {
  publicKey: string;
  secretKey: string;
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

function reduceLoading() {
  return {
    loading: true,
    error: undefined,
    success: undefined,
    data: undefined,
  };
}
function reduceError(payload: { message: string }) {
  return {
    loading: false,
    error: new Error(payload?.message),
    success: false,
    data: undefined,
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
      return reduceLoading();
    case "TOKEN_LIST_ERROR":
      return reduceError(action.payload);
    case "TOKEN_LIST_SUCCESS":
      return reduceSuccess(action.payload);
    case "TOKEN_ADD":
      return reduceLoading();
    case "TOKEN_ADD_ERROR":
      return reduceError(action.payload);
    case "TOKEN_ADD_SUCCESS":
      return reduceSuccess([...(state.data ?? []), action.payload]);
    default:
      if (!state.data) return state;
      return state;
  }
}

function accountReducer(state: SolanaAccountState = {}, action: SolanaAction): SolanaAccountState {
  switch (action.type) {
    case "ACCOUNT_GET":
      return reduceLoading();
    case "ACCOUNT_GET_ERROR":
      return reduceError(action.payload);
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
      return reduceLoading();
    case "CONNECT_ERROR":
      return reduceError(action.payload);
    case "CONNECT_SUCCESS":
      return reduceSuccess(action.payload);
    default:
      if (!state.data) return state;
      return {
        ...state,
        data: {
          ...state.data,
          account: accountReducer(state.data?.account ?? {}, action),
        },
      };
  }
}

function reducer(state: SolanaState = {}, action: SolanaAction): SolanaState {
  console.log("action", action);
  return {
    connection: connectionReducer(state.connection, action),
  };
}

export function SolanaProvider({ children }: PropsWithChildren<unknown>) {
  const [assets, error] = useAssets([require("./webview/index.html"), require("./webview/index.cjs")]);
  const indexHtmlUri = assets?.[0]?.uri;
  const indexJsPath = assets?.[1]?.localUri;
  const [injectedJavaScript, setInjectedJavaScript] = useState<string>();
  useEffect(() => {
    (async () => {
      if (indexJsPath) setInjectedJavaScript(await FileSystem.readAsStringAsync(indexJsPath));
    })();
  }, [indexJsPath]);

  const webview = useRef<WebView>(null);
  const [state, nativeDispatch] = useReducer<Reducer<SolanaState, SolanaAction>>(reducer, initialState);

  function dispatch(action: SolanaAction) {
    webview.current?.injectJavaScript(`webDispatch(${JSON.stringify(action)})`);
    nativeDispatch(action);
  }

  const [loading, setLoading] = useState(true);

  return (
    <SolanaContext.Provider value={[state, dispatch]}>
      <View style={{ height: 0 }}>
        {indexHtmlUri && injectedJavaScript && (
          <WebView
            ref={webview}
            source={{ uri: indexHtmlUri }}
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
  useEffect(() => {
    if (!state.connection?.success && !state.connection?.loading) {
      dispatch({ type: "CONNECT", payload: options });
    }
  }, []);
  return state.connection ?? {};
}

export function useAccount(): SolanaAccountState {
  const [, dispatch] = useSolana();
  const conn = useConnection();
  const secretKey = conn?.data?.account?.data?.secretKey;
  const publicKey = conn?.data?.account?.data?.publicKey;
  useEffect(() => {
    if (secretKey) {
      AsyncStorage.setItem("account-secret-key", secretKey);
    }
  }, [secretKey]);
  useEffect(() => {
    if (secretKey) {
      AsyncStorage.setItem("account-public-key", secretKey);
    }
  }, [publicKey]);
  useEffect(() => {
    (async () => {
      if (!conn.success || conn?.data?.account?.success || conn?.data?.account?.loading) return;
      dispatch({
        type: "ACCOUNT_GET",
        payload: {
          secretKey: (await AsyncStorage.getItem("account-secret-key")) ?? undefined,
          publicKey: (await AsyncStorage.getItem("account-public-key")) ?? undefined,
        },
      });
    })();
  }, [conn.success, conn?.data?.account?.data]);
  const { data, ...rest } = conn;
  return conn?.data?.account ?? rest;
}
