import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet } from "react-native";

import { RootTabScreenProps } from "../types";

export default function TokenList({ navigation }: RootTabScreenProps<"TokenList">) {
  const tokens = useState([]);
  useEffect(() => {}, []);
  return (
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
