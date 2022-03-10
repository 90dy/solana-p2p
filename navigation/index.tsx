/**
 * If you are not familiar with React Navigation, refer to the "Fundamentals" guide:
 * https://reactnavigation.org/docs/getting-started
 *
 */
import { FontAwesome } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as React from "react";
import { ActivityIndicator, ColorSchemeName, Pressable } from "react-native";

import Colors from "../constants/Colors";
import useColorScheme from "../hooks/useColorScheme";
import useSolana, { useAccount } from "../lib/solana";
import AuthScreen from "../screens/AuthScreen";
import ModalScreen from "../screens/ModalScreen";
import NotFoundScreen from "../screens/NotFoundScreen";
import TabOneScreen from "../screens/TabOneScreen";
import TabTwoScreen from "../screens/TabTwoScreen";
import TokenInfoScreen from "../screens/TokenInfoScreen";
import TokenListScreen from "../screens/TokenListScreen";
import { RootStackParamList, RootTabParamList, RootTabScreenProps, TokenStackParamList } from "../types";
import LinkingConfiguration from "./LinkingConfiguration";

export default function Navigation({ colorScheme }: { colorScheme: ColorSchemeName }) {
  return (
    <NavigationContainer linking={LinkingConfiguration} theme={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <RootNavigator />
    </NavigationContainer>
  );
}

/**
 * A root stack navigator is often used for displaying modals on top of all other content.
 * https://reactnavigation.org/docs/modal
 */
const RootStack = createNativeStackNavigator<RootStackParamList>();

function RootNavigator() {
  const { success } = useAccount();
  return (
    <RootStack.Navigator>
      {!success ? (
        <RootStack.Screen name="Auth" component={AuthScreen} />
      ) : (
        <RootStack.Screen name="Root" component={BottomTabNavigator} options={{ headerShown: false }} />
      )}
      <RootStack.Group screenOptions={{ presentation: "modal" }}>
        <RootStack.Screen name="Modal" component={ModalScreen} />
      </RootStack.Group>
      <RootStack.Screen name="NotFound" component={NotFoundScreen} options={{ title: "Oops!" }} />
    </RootStack.Navigator>
  );
}

/**
 * A bottom tab navigator displays tab buttons on the bottom of the display to switch screens.
 * https://reactnavigation.org/docs/bottom-tab-navigator
 */
const BottomTab = createBottomTabNavigator<RootTabParamList>();

function BottomTabNavigator() {
  const colorScheme = useColorScheme();
  const [, dispatch] = useSolana();

  return (
    <BottomTab.Navigator
      initialRouteName="TokenList"
      screenOptions={({ route: { name } }) => ({
        tabBarActiveTintColor: Colors[colorScheme].tint,
        headerShown: !name.startsWith("Token"),
      })}
    >
      <BottomTab.Screen
        name="TokenList"
        component={TokenNavigator}
        options={({ navigation }: RootTabScreenProps<"TokenList">) => ({
          title: "Tokens",
          tabBarIcon: ({ color }) => <TabBarIcon name="dollar" color={color} />,
        })}
      />
      {/* <BottomTab.Screen
        name="TabOne"
        component={TabOneScreen}
        options={({ navigation }: RootTabScreenProps<"TabOne">) => ({
          title: "Tab One",
          tabBarIcon: ({ color }) => <TabBarIcon name="code" color={color} />,
          headerRight: () => (
            <Pressable
              onPress={() => navigation.navigate("Modal")}
              style={({ pressed }) => ({
                opacity: pressed ? 0.5 : 1,
              })}
            >
              <FontAwesome name="info-circle" size={25} color={Colors[colorScheme].text} style={{ marginRight: 15 }} />
            </Pressable>
          ),
        })}
      />
      <BottomTab.Screen
        name="TabTwo"
        component={TabTwoScreen}
        options={{
          title: "Tab Two",
          tabBarIcon: ({ color }) => <TabBarIcon name="code" color={color} />,
        }}
      /> */}
    </BottomTab.Navigator>
  );
}

const TokenStack = createNativeStackNavigator<TokenStackParamList>();

function TokenNavigator() {
  const colorScheme = useColorScheme();
  return (
    <TokenStack.Navigator>
      <TokenStack.Screen
        name="TokenList"
        component={TokenListScreen}
        options={{
          title: "Tokens",
          headerRight: () => {
            const [, dispatch] = useSolana();
            return (
              <Pressable
                onPress={() => dispatch({ type: "TOKEN_ADD" })}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.5 : 1,
                })}
              >
                <FontAwesome
                  name="plus-circle"
                  size={25}
                  color={Colors[colorScheme].text}
                  style={{ marginRight: 15 }}
                />
              </Pressable>
            );
          },
        }}
      />
      <TokenStack.Screen name="TokenInfo" component={TokenInfoScreen} options={{ title: "Token" }} />
    </TokenStack.Navigator>
  );
}

/**
 * You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/
 */
function TabBarIcon(props: { name: React.ComponentProps<typeof FontAwesome>["name"]; color: string }) {
  return <FontAwesome size={30} style={{ marginBottom: -3 }} {...props} />;
}
