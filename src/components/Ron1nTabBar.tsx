import React from 'react';
import {
  Platform,
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

const iconMap: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  Wallet: {
    active: 'wallet',
    inactive: 'wallet-outline',
  },
  Send: {
    active: 'paper-plane',
    inactive: 'paper-plane-outline',
  },
  Assets: {
    active: 'layers',
    inactive: 'layers-outline',
  },
  Security: {
    active: 'shield-checkmark',
    inactive: 'shield-checkmark-outline',
  },
  Activity: {
    active: 'pulse',
    inactive: 'pulse-outline',
  },
  Settings: {
    active: 'settings',
    inactive: 'settings-outline',
  },
  Disclosures: {
    active: 'document-text',
    inactive: 'document-text-outline',
  },
};

export default function Ron1nTabBar({ state, descriptors, navigation }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        {state.routes.map((route: any, index: number) => {
          const focused = state.index === index;
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
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              onPress={onPress}
              style={styles.item}
              activeOpacity={0.8}
            >
              <Ionicons
                name={focused ? icons.active : icons.inactive}
                size={20}
                color={focused ? Ron1nColors.green : '#777777'}
              />

              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  { color: focused ? Ron1nColors.green : '#777777' },
                ]}
              >
                {String(label).toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: Platform.OS === 'ios' ? 22 : 10,
  },
  bar: {
    minHeight: 76,
    borderRadius: 24,
    backgroundColor: '#050505F2',
    borderWidth: 1,
    borderColor: '#1F1F1F',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  label: {
    fontSize: 6.5,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
});