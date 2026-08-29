import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from "react-native-safe-area-context"
import { Toaster } from 'sonner-native';
import HomeScreen from "./screens/HomeScreen"
import CreateDashScreen from "./screens/CreateDashScreen"
import JoinDashScreen from "./screens/JoinDashScreen"
import LobbyScreen from "./screens/LobbyScreen"
import DashRaceScreen from "./screens/DashRaceScreen"
import ResultsScreen from "./screens/ResultsScreen"

// Bill Dash navigation stack — see docs/ARCHITECTURE.md for the full spec.
export type RootStackParamList = {
  Home: undefined;
  CreateDash: { userId: string };
  JoinDash: { userId: string };
  Lobby: { dashId: string; code: string; userId: string };
  DashRace: { dashId: string; code: string; userId: string };
  Results: { dashId: string; code: string; userId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function RootStack() {
  return (
    <Stack.Navigator screenOptions={{
      headerShown: false
    }}>
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{
          animation: 'fade'
        }}
      />
      <Stack.Screen name="CreateDash" component={CreateDashScreen} />
      <Stack.Screen name="JoinDash" component={JoinDashScreen} />
      <Stack.Screen name="Lobby" component={LobbyScreen} />
      <Stack.Screen name="DashRace" component={DashRaceScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="Results" component={ResultsScreen} options={{ gestureEnabled: false }} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider style={styles.container}>
      <Toaster position="top-center" />
      <NavigationContainer>
        <RootStack />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    userSelect: "none"
  }
});
