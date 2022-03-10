import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-elements";
import { useTokenList } from "../lib/solana";

import { TokenStackScreenProps } from "../types";

export default function TokenList({ navigation }: TokenStackScreenProps<"TokenList">) {
  const { data: tokens, loading, error } = useTokenList();

  return (
    <ScrollView>
      {loading ? (
        <ActivityIndicator />
      ) : error ? (
        <>
          <Text>Error: {error.message}</Text>
        </>
      ) : undefined}
      {tokens?.map((token) => (
        <Button
          key={token.account.address}
          onPress={() => navigation.push("TokenInfo", { address: token.account.address })}
          type="outline"
          title={
            <View style={{ flexDirection: "column" }}>
              <Text style={{ fontWeight: "bold", fontSize: 12 }}>{token.account.address}</Text>
              <Text style={{ fontStyle: "italic", fontSize: 12 }}>mint: {token.mint.address}</Text>
              <Text style={{ fontStyle: "italic", fontSize: 12 }}>
                {token.account.amount} / {token.mint.supply}
              </Text>
            </View>
          }
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  separator: {
    marginVertical: 30,
    height: 1,
    width: "80%",
  },
});
