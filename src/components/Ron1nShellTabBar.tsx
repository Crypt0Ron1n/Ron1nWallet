import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Ron1nColors } from '../theme/ron1nTheme';

export type ShellRouteName = 'Syndicate' | 'Shogun' | 'Security';

type Props = {
  active: ShellRouteName | null;
  onSelect: (route: ShellRouteName) => void;
};

const SHELL_ROUTES: ShellRouteName[] = ['Syndicate', 'Shogun', 'Security'];

const iconMap: Record<
  ShellRouteName,
  { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }
> = {
  Syndicate: { active: 'aperture', inactive: 'aperture-outline' },
  Shogun: { active: 'wallet', inactive: 'wallet-outline' },
  Security: { active: 'shield-checkmark', inactive: 'shield-checkmark-outline' },
};

/**
 * Top-level product shell: SYNDICATE / SHOGUN / SECURITY.
 *
 * This renders in normal document flow above the active section, not as a
 * React Navigation `tabBar` (which always docks to the bottom of its own
 * navigator) - that would collide with Shogun's existing bottom tab bar.
 * Navigation itself happens through the `onSelect` callback, which the
 * caller wires to a navigation ref.
 */
export default function Ron1nShellTabBar({ active, onSelect }: Props) {
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.bar}>
        {SHELL_ROUTES.map((route) => {
          const focused = route === active;
          const icons = iconMap[route];

          return (
            <TouchableOpacity
              key={route}
              accessibilityRole="tab"
              accessibilityLabel={route.toUpperCase()}
              accessibilityState={{ selected: focused }}
              onPress={() => onSelect(route)}
              style={[styles.item, focused && styles.itemActive]}
              activeOpacity={0.85}
            >
              <Ionicons
                name={focused ? icons.active : icons.inactive}
                size={19}
                color={focused ? Ron1nColors.neonPurple : '#8A8A96'}
              />
              <Text style={[styles.label, { color: focused ? Ron1nColors.white : '#8A8A96' }]}>
                {route.toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: Ron1nColors.black,
  },
  bar: {
    flexDirection: 'row',
    height: 54,
    marginHorizontal: 14,
    marginBottom: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(140,0,255,0.35)',
    backgroundColor: '#08080C',
    overflow: 'hidden',
  },
  item: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  itemActive: {
    backgroundColor: 'rgba(176,38,255,0.16)',
  },
  label: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
