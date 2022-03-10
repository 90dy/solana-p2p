import { ActivityIndicator } from "react-native";
import { Text } from "react-native-elements";
import { useTokenInfo } from "../lib/solana";
import { TokenStackScreenProps } from "../types";

export default function TokenInfoScreen({
  route: {
    params: { address },
  },
}: TokenStackScreenProps<"TokenInfo">) {
  const { data: token, loading, error } = useTokenInfo(address);
  return loading ? (
    <ActivityIndicator />
  ) : error ? (
    <Text>Error: {error.message}</Text>
  ) : (
    <>
      <Text h4>Mint</Text>
      {Object.entries(token?.mint ?? {}).map(([key, value]) => (
        <Text style={{ fontSize: 12 }}>
          {key}: {typeof value === "boolean" ? value.toString() : value}
        </Text>
      ))}

      <Text h4>Account</Text>
      {Object.entries(token?.account ?? {}).map(([key, value]) => (
        <Text style={{ fontSize: 12 }}>
          {key}: {typeof value === "boolean" ? value.toString() : value}
        </Text>
      ))}
    </>
  );
}
