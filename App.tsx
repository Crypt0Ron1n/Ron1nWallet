import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ron1nColors } from './src/theme/ron1nTheme';
import Ron1nTabBar from './src/components/Ron1nTabBar';

import WalletScreen from './src/screens/WalletScreen';
import SendScreen from './src/screens/SendScreen';
import AssetsScreen from './src/screens/AssetsScreen';
import SecurityScreen from './src/screens/SecurityScreen';
import DisclosuresScreen from './src/screens/DisclosuresScreen';

const Tab = createBottomTabNavigator();

const Ron1nTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: Ron1nColors.black, card: Ron1nColors.black2, primary: Ron1nColors.purple, text: Ron1nColors.white },
};

export default function App() {
  return (
    <NavigationContainer theme={Ron1nTheme}>
      <Tab.Navigator tabBar={(props) => <Ron1nTabBar {...props} />} screenOptions={{ headerShown: false, lazy: true }}>
        <Tab.Screen name="Wallet" component={WalletScreen} />
        <Tab.Screen name="Send" component={SendScreen} />
        <Tab.Screen name="Assets" component={AssetsScreen} />
        <Tab.Screen name="Security" component={SecurityScreen} />
        <Tab.Screen name="Disclosures" component={DisclosuresScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}