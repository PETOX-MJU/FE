import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '@/screens/HomeScreen';
import { ScreentimeDashboardScreen } from '@/screens/ScreentimeDashboardScreen';

export type RootStackParamList = {
  Home: undefined;
  ScreentimeDashboard: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="ScreentimeDashboard" component={ScreentimeDashboardScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
