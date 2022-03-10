import { ActivityIndicator, Text, View } from "react-native";
import { useAccount } from "../lib/solana";

export default function AuthScreen() {
  const { loading, error } = useAccount();
  return (
    <View style={{ flex: 1, justifyContent: "center" }}>
      {loading ? (
        <>
          <ActivityIndicator size="large" />
          <Text style={{ textAlign: "center" }}>Retrieving account ...</Text>
        </>
      ) : error ? (
        <Text>Error: {error.message}</Text>
      ) : null}
    </View>
  );
}
