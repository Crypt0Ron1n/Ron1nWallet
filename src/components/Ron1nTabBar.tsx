import React from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Ron1nColors } from '../theme/ron1nTheme';

type Props = {
  state: any;
  descriptors: any;
  navigation: any;
};

const iconMap: Record<
  string,
  {
    active: keyof typeof Ionicons.glyphMap;
    inactive: keyof typeof Ionicons.glyphMap;
  }
> = {
  Wallet: { active: 'wallet', inactive: 'wallet-outline' },
  Send: { active: 'paper-plane', inactive: 'paper-plane-outline' },
  Assets: { active: 'layers', inactive: 'layers-outline' },
  Security: {
    active: 'shield-checkmark',
    inactive: 'shield-checkmark-outline',
  },
  Activity: { active: 'pulse', inactive: 'pulse-outline' },
  Settings: { active: 'settings', inactive: 'settings-outline' },
  Disclosures: {
    active: 'document-text',
    inactive: 'document-text-outline',
  },
};

// Primary bar keeps only the screens someone reaches for daily. Assets
// (the supported-chains catalog) and Disclosures (legal/policy text) are
// still fully navigable - just via a button inside Wallet/Settings instead
// of taking a slot here - since they're reference screens, not actions.
// Security is promoted to the outer Ron1n Syndicate shell (Ron1nShellTabBar)
// and is still reachable from in-screen buttons (e.g. Wallet's SECURITY
// action), so it is intentionally not duplicated in this inner bar.
const BAR_ROUTE_NAMES = ['Wallet', 'Send', 'Activity', 'Settings'];
const ITEM_WIDTH = 76;

export default function Ron1nTabBar({ state, descriptors, navigation }: Props) {
  const allRoutes = state.routes as any[];
  const barRoutes = allRoutes.filter((route) => BAR_ROUTE_NAMES.includes(route.name));
  const activeRoute = allRoutes[state.index];

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {barRoutes.map((route: any) => {
            const focused = route.key === activeRoute?.key;
            const options = descriptors[route.key]?.options || {};
            const label = options.tabBarLabel || options.title || route.name;
            const icons = iconMap[route.name] || {
              active: 'ellipse',
              inactive: 'ellipse-outline',
            };

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            return (
              <TouchableOpacity
                key={route.key}
                accessibilityRole="tab"
                accessibilityLabel={String(label)}
                accessibilityState={{ selected: focused }}
                onPress={onPress}
                style={[styles.item, focused && styles.itemActive]}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={focused ? icons.active : icons.inactive}
                  size={22}
                  color={focused ? Ron1nColors.neonPurple : '#B4B4C0'}
                />

                <Text
                  numberOfLines={1}
                  style={[
                    styles.label,
                    { color: focused ? Ron1nColors.white : '#B4B4C0' },
                  ]}
                >
                  {String(label).toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: Platform.OS === 'ios' ? 10 : 8,
  },
  bar: {
    height: 72,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(140,0,255,0.45)',
    backgroundColor: '#08080C',
    shadowColor: Ron1nColors.purple,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  scrollContent: {
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  item: {
    width: ITEM_WIDTH,
    height: 60,
    marginHorizontal: 2,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  itemActive: {
    backgroundColor: 'rgba(140,0,255,0.18)',
    borderColor: 'rgba(140,0,255,0.75)',
  },
  label: {
    marginTop: 5,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
});
