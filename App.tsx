import React, { useEffect, useState } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import {
  NavigationContainer,
  DarkTheme,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ScreenProtectionService } from './src/services/ScreenProtectionService';

import ActivityScreen from './src/screens/ActivityScreen';
import AssetsScreen from './src/screens/AssetsScreen';
import DisclosuresScreen from './src/screens/DisclosuresScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import SecurityScreen from './src/screens/SecurityScreen';
import SendScreen from './src/screens/SendScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import WalletScreen from './src/screens/WalletScreen';
import AssetProtectionScreen from './src/screens/AssetProtectionScreen';
import SyndicateScreen from './src/screens/SyndicateScreen';
import Ron1nTabBar from './src/components/Ron1nTabBar';
import Ron1nShellTabBar, { type ShellRouteName } from './src/components/Ron1nShellTabBar';
import { VaultService } from './src/services/VaultService';
import {
  StartupPreferenceService,
  type StartupDestination,
} from './src/services/StartupPreferenceService';
import { Ron1nColors } from './src/theme/ron1nTheme';
import Ron1nSeoMetadata from './src/components/Ron1nSeoMetadata';

const Tab = createBottomTabNavigator();
const ShellTab = createBottomTabNavigator();
const navigationRef = createNavigationContainerRef();

function destinationToRoute(destination: StartupDestination): ShellRouteName {
  if (destination === 'SHOGUN') return 'Shogun';
  if (destination === 'SECURITY') return 'Security';
  return 'Syndicate';
}

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

const startupSpin = new Animated.Value(0);

function StartupLoadingScreen() {
  React.useEffect(() => {
    startupSpin.setValue(0);

    const animation = Animated.loop(
      Animated.timing(startupSpin, {
        toValue: 1,
        duration: 1300,
        useNativeDriver: true,
      })
    );

    animation.start();

    return () => {
      animation.stop();
      startupSpin.setValue(0);
    };
  }, []);

  const rotate = startupSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={startupStyles.screen}>
      <View style={startupStyles.artFrame}>
        <Image
          source={require('./assets/rs-gold.png')}
          style={startupStyles.art}
          resizeMode="contain"
          accessibilityRole="image"
          accessibilityLabel="Ron1n Syndicate startup emblem"
        />

        <Animated.View
          pointerEvents="none"
          accessibilityRole="progressbar"
          accessibilityLabel="Loading secure vault"
          style={[
            startupStyles.loaderRing,
            { transform: [{ rotate }] },
          ]}
        />
      </View>

      <Text style={startupStyles.title}>RON1N SYNDICATE</Text>
      <Text style={startupStyles.subtitle}>SECURE WALLET INITIALIZING</Text>
      <Text style={startupStyles.status}>LOADING SECURE VAULT</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shellRoot: {
    flex: 1,
    backgroundColor: Ron1nColors.black,
  },
  shellContent: {
    flex: 1,
  },
});

const startupStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Ron1nColors.black,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  artFrame: {
    width: 300,
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  art: {
    width: 230,
    height: 230,
  },
  loaderRing: {
    position: 'absolute',
    width: 276,
    height: 276,
    borderRadius: 138,
    borderWidth: 6,
    borderColor: Ron1nColors.neonPurple,
    borderTopColor: Ron1nColors.purpleHighlight,
    borderRightColor: 'transparent',
    borderBottomColor: Ron1nColors.purple,
    borderLeftColor: 'transparent',
    shadowColor: Ron1nColors.neonPurple,
    shadowOpacity: 0.95,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 14,
  },
  title: {
    color: Ron1nColors.gold,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 4,
    textAlign: 'center',
  },
  subtitle: {
    color: Ron1nColors.neonPurple,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2.5,
    marginTop: 8,
    textAlign: 'center',
  },
  status: {
    color: Ron1nColors.neonGreen,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 22,
    textAlign: 'center',
  },
});

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
      <Tab.Screen name="AssetProtection" component={AssetProtectionScreen} />
      <Tab.Screen name="Activity" component={ActivityScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
      <Tab.Screen name="Disclosures" component={DisclosuresScreen} />
    </Tab.Navigator>
  );
}

/**
 * Ron1n Syndicate application shell: the three primary product areas
 * (Syndicate / Shogun / Security) as sibling tabs so each keeps its mounted
 * state when the user switches between them. The shell's own tab bar is
 * rendered separately (see Ron1nShellTabBar) - this navigator's built-in bar
 * is disabled so it doesn't collide with Shogun's existing bottom tab bar.
 */
function ShellTabs({ initialRouteName }: { initialRouteName: ShellRouteName }) {
  return (
    <ShellTab.Navigator
      initialRouteName={initialRouteName}
      tabBar={() => null}
      screenOptions={{ headerShown: false, lazy: true }}
    >
      <ShellTab.Screen name="Syndicate" component={SyndicateScreen} />
      <ShellTab.Screen name="Shogun" component={AppTabs} />
      <ShellTab.Screen name="Security" component={SecurityScreen} />
    </ShellTab.Navigator>
  );
}

export default function App() {
  const [checkingVault, setCheckingVault] = useState(true);
  const [hasVault, setHasVault] = useState(false);
  const [initialShellRoute, setInitialShellRoute] = useState<ShellRouteName>('Syndicate');
  const [activeShellRoute, setActiveShellRoute] = useState<ShellRouteName>('Syndicate');

  const checkVault = async () => {
    try {
      const [mnemonic, startupDestination] = await Promise.all([
        VaultService.getMnemonic(),
        StartupPreferenceService.getStartupDestination(),
      ]);

      setHasVault(Boolean(mnemonic));

      const route = destinationToRoute(startupDestination);
      setInitialShellRoute(route);
      setActiveShellRoute(route);
    } catch (error) {
      setHasVault(false);
    } finally {
      setCheckingVault(false);
    }
  };

  useEffect(() => {
    ScreenProtectionService.applySavedPreference();
    checkVault();
  }, []);

  if (checkingVault) {
    return <StartupLoadingScreen />;
  }

  return (
    <>
      <Ron1nSeoMetadata />
      <NavigationContainer
        theme={Ron1nTheme}
        ref={navigationRef}
        onStateChange={() => {
          if (!navigationRef.isReady()) return;

          const rootState = navigationRef.getRootState();
          const current = rootState?.routes?.[rootState.index ?? 0]?.name;

          if (current === 'Syndicate' || current === 'Shogun' || current === 'Security') {
            setActiveShellRoute(current);
          }
        }}
      >
        {hasVault ? (
          <View style={styles.shellRoot}>
            <Ron1nShellTabBar
              active={activeShellRoute}
              onSelect={(route) => {
                if (navigationRef.isReady()) {
                  navigationRef.navigate(route as never);
                }
              }}
            />
            <View style={styles.shellContent}>
              <ShellTabs initialRouteName={initialShellRoute} />
            </View>
          </View>
        ) : (
          <OnboardingScreen onComplete={() => setHasVault(true)} />
        )}
      </NavigationContainer>
    </>
  );
}
