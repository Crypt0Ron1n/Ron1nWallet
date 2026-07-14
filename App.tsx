import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import ActivityScreen from './src/screens/ActivityScreen';
import AssetsScreen from './src/screens/AssetsScreen';
import DisclosuresScreen from './src/screens/DisclosuresScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import SecurityScreen from './src/screens/SecurityScreen';
import SendScreen from './src/screens/SendScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import WalletScreen from './src/screens/WalletScreen';
import Ron1nTabBar from './src/components/Ron1nTabBar';
import { VaultService } from './src/services/VaultService';
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

function AppTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <Ron1nTabBar {...props} />}
      screenOptions={{ headerShown: false, lazy: true }}
    >
      <Tab.Screen name="Wallet" component={WalletScreen} />
      <Tab.Screen name="Send" component={SendScreen} />
      <Tab.Screen name="Assets" component={AssetsScreen} />
      <Tab.Screen name="Security" component={SecurityScreen} />
      <Tab.Screen name="Activity" component={ActivityScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
      <Tab.Screen name="Disclosures" component={DisclosuresScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [checkingVault, setCheckingVault] = useState(true);
  const [hasVault, setHasVault] = useState(false);

  const checkVault = async () => {
    try {
      const mnemonic = await VaultService.getMnemonic();
      setHasVault(Boolean(mnemonic));
    } catch (error) {
      setHasVault(false);
    } finally {
      setCheckingVault(false);
    }
  };

  useEffect(() => {
    checkVault();
  }, []);

  if (checkingVault) {
    return (
      <NavigationContainer theme={Ron1nTheme}>
        <View
          style={{
            flex: 1,
            backgroundColor: Ron1nColors.black,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ActivityIndicator size="large" color={Ron1nColors.green} />
        </View>
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer theme={Ron1nTheme}>
      {hasVault ? <AppTabs /> : <OnboardingScreen onComplete={() => setHasVault(true)} />}
    </NavigationContainer>
  );
}