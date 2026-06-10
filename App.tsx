import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import WalletScreen from './src/screens/WalletScreen';
import SendScreen from './src/screens/SendScreen';
import RFTsScreen from './src/screens/RFTsScreen';
import MarketplaceScreen from './src/screens/MarketplaceScreen';
import SecurityScreen from './src/screens/SecurityScreen';

const Tab = createBottomTabNavigator();

const Ron1nTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#050505',
    card: '#0A0A0A',
    border: '#222222',
    text: '#FFFFFF',
    primary: '#00FF41',
  },
};

export default function App() {
  return (
    <NavigationContainer theme={Ron1nTheme}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#0A0A0A',
            borderTopColor: '#222222',
            paddingBottom: 5,
            paddingTop: 5,
            height: 62,
          },
          tabBarActiveTintColor: '#00FF41',
          tabBarInactiveTintColor: '#555555',
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: keyof typeof Ionicons.glyphMap = 'wallet-outline';

            if (route.name === 'Wallet') iconName = focused ? 'wallet' : 'wallet-outline';
            if (route.name === 'Send') iconName = focused ? 'paper-plane' : 'paper-plane-outline';
            if (route.name === 'RFTs') iconName = focused ? 'cube' : 'cube-outline';
            if (route.name === 'Market') iconName = focused ? 'swap-horizontal' : 'swap-horizontal-outline';
            if (route.name === 'Security') iconName = focused ? 'shield-checkmark' : 'shield-checkmark-outline';

            return <Ionicons name={iconName} size={size} color={color} />;
          },
        })}
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