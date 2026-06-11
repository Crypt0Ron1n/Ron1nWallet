import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import WalletScreen from './src/screens/WalletScreen';
import SendScreen from './src/screens/SendScreen';
import RFTsScreen from './src/screens/RFTsScreen';
import MarketplaceScreen from './src/screens/MarketplaceScreen';
import SecurityScreen from './src/screens/SecurityScreen';
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

function TabIcon({
  routeName,
  focused,
  color,
  size,
}: {
  routeName: string;
  focused: boolean;
  color: string;
  size: number;
}) {
  let iconName: keyof typeof Ionicons.glyphMap = 'wallet-outline';

  if (routeName === 'Wallet') iconName = focused ? 'wallet' : 'wallet-outline';
  if (routeName === 'Send') iconName = focused ? 'paper-plane' : 'paper-plane-outline';
  if (routeName === 'RFTs') iconName = focused ? 'cube' : 'cube-outline';
  if (routeName === 'Market') iconName = focused ? 'swap-horizontal' : 'swap-horizontal-outline';
  if (routeName === 'Security') iconName = focused ? 'shield-checkmark' : 'shield-checkmark-outline';

  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Ionicons name={iconName} size={size} color={color} />
    </View>
  );
}

export default function App() {
  return (
    <NavigationContainer theme={Ron1nTheme}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: Ron1nColors.green,
          tabBarInactiveTintColor: '#666666',
          tabBarLabelStyle: styles.tabLabel,
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon routeName={route.name} focused={focused} color={color} size={size} />
          ),
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

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    backgroundColor: 'rgba(5,5,5,0.96)',
    borderTopColor: '#B026FF55',
    borderTopWidth: 1,
    height: 72,
    paddingTop: 8,
    paddingBottom: 10,
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: '800',
  },
  iconWrap: {
    width: 34,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  iconWrapActive: {
    backgroundColor: '#00FF4120',
    borderWidth: 1,
    borderColor: '#00FF4144',
  },
});