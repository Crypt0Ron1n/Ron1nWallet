import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import WalletScreen from './src/screens/WalletScreen';
import SendScreen from './src/screens/SendScreen';
import RFTsScreen from './src/screens/RFTsScreen';
import MarketplaceScreen from './src/screens/MarketplaceScreen';
import SecurityScreen from './src/screens/SecurityScreen';
import Ron1nTabBar from './src/components/Ron1nTabBar';
import { Ron1nColors } from './src/theme/ron1nTheme';

const Tab = createBottomTabNavigator();

const Ron1nTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Ron1nColors.black,
    card: Ron1nColors.black2,
    border: '#222222',
    text: Ron1nColors.white,
    primary: Ron1nColors.green,
  },
};

export default function App() {
  return (
    <NavigationContainer theme={Ron1nTheme}>
      <Tab.Navigator
        tabBar={(props) => <Ron1nTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          lazy: true,
        }}
      >
        <Tab.Screen name="Wallet" component={WalletScreen} />
        <Tab.Screen name="Send" component={SendScreen} />
        <Tab.Screen name="RFTs" component={RFTsScreen} />
        <Tab.Screen name="Market" component={MarketplaceScreen} />
        <Tab.Screen name="Security" component={SecurityScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}