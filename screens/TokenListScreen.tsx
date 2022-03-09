import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { useAccount } from "../lib/solana";

import { RootTabScreenProps } from "../types";

export default function TokenList({ navigation }: RootTabScreenProps<"TokenList">) {
  const { data: account, loading, error } = useAccount();
  const tokens = useState([]);
  return loading ? (
    <ActivityIndicator />
  ) : error ? (
    <Text>Error: {error.message}</Text>
  ) : (
    <ScrollView>
      {tokens.map((token, index) => (
        <Pressable key={index} onPress={() => {}}></Pressable>
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
