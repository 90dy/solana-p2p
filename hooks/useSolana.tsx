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

export type SolanaAccountAction = AsyncAction<"ACCOUNT_GET", { secretKey?: string | null }, SolanaAccount>;

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
  return {
    connection: connectionReducer(state.connection, action),
  };
}

export function SolanaProvider({ children }: PropsWithChildren<unknown>) {
  const [assets, error] = useAssets([require("../assets/solana/index.html"), require("../assets/solana/index.js")]);
  const uri = assets?.[0]?.uri;

  const webview = useRef<WebView>(null);
  const [state, nativeDispatch] = useReducer<Reducer<SolanaState, SolanaAction>>(reducer, initialState);

  function dispatch(action: SolanaAction) {
    webview.current?.injectJavaScript(`webDispatch(${JSON.stringify(action)})`);
    nativeDispatch(action);
  }

  // inject solana web & connect to solana cluster
  useEffect(() => {
    if (!webview.current) return;
    webview.current?.injectJavaScript(`
			const script = document.createElement('script')
			script.src = "${assets?.[1]?.uri}"
			document.head.appendChild(script)
		`);
  }, [webview?.current]);

  return (
    <>
      {uri && (
        <WebView
          ref={webview}
          // @ts-ignore
          source={{ uri }}
          onLoadStart={() => {}}
          onMessage={(event) => {
            const action = JSON.parse(event.nativeEvent.data) as SolanaAction;
            nativeDispatch(action);
          }}
          allowFileAccess
          javaScriptEnabled
        />
      )}
      <SolanaContext.Provider value={[state, dispatch]}>{children}</SolanaContext.Provider>
    </>
  );
}

export default function useSolana() {
  return useContext(SolanaContext);
}

export function useConnection(options: { cluster: Web3.Cluster } = { cluster: "devnet" }): SolanaConnectionState {
  const [state, dispatch] = useSolana();
  useEffect(() => {
    if (state.connection?.data) return;
    dispatch({ type: "CONNECT", payload: options });
  }, [state.connection]);
  return state.connection ?? {};
}

export function useAccount(): SolanaAccountState {
  const [, dispatch] = useSolana();
  const { data: conn, ...rest } = useConnection();
  useEffect(() => {
    (async () => {
      // TODO: should not save secretkey everytime we call useAccount
      if (conn?.account?.data?.secretKey) {
        return AsyncStorage.setItem("account-secret-key", conn.account.data.secretKey);
      }
      dispatch({ type: "ACCOUNT_GET", payload: { secretKey: await AsyncStorage.getItem("account-secret-key") } });
    })();
  }, [conn?.account?.data]);
  return conn?.account ?? rest;
}
