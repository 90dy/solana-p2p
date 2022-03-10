import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAccount, useTokenList } from "../lib/solana";

import { RootTabScreenProps } from "../types";

export default function TokenList({ navigation }: RootTabScreenProps<"TokenList">) {
  const { data: tokens, loading, error } = useTokenList();

  return loading ? (
    <ActivityIndicator />
  ) : error ? (
    <>
      <Text>Error: {error.message}</Text>
    </>
  ) : (
    <ScrollView>
      {tokens?.map((token, index) => (
        <View key={token.account.address}>
          <Text>
            {token.account.address} (mint: {token.mint.address})
          </Text>
          <Text>
            {token.account.amount} / {token.mint.supply}
          </Text>
        </View>
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
