import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import Ron1nPressable from './Ron1nPressable';
import { Ron1nColors } from '../theme/ron1nTheme';

const ICONS: Record<
  string,
  [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]
> = {
  Wallet: ['wallet', 'wallet-outline'],
  Send: ['paper-plane', 'paper-plane-outline'],
  Assets: ['layers', 'layers-outline'],
  Security: ['shield-checkmark', 'shield-checkmark-outline'],
};

export default function Ron1nTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const [activeIcon, inactiveIcon] = ICONS[route.name] || [
            'ellipse',
            'ellipse-outline',
          ];
          const icon = focused ? activeIcon : inactiveIcon;
          const label = descriptors[route.key].options.tabBarLabel ?? route.name;

          return (
            <Ron1nPressable
              key={route.key}
              style={[styles.item, focused && styles.itemActive]}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });

                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              }}
            >
              <View style={[styles.iconHalo, focused && styles.iconHaloActive]}>
                <Ionicons
                  name={icon}
                  size={21}
                  color={focused ? Ron1nColors.green : '#777'}
                />
              </View>

              <Text style={[styles.label, focused && styles.labelActive]}>
                {String(label).toUpperCase()}
              </Text>
            </Ron1nPressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: Platform.OS === 'ios' ? 24 : 12,
  },
  bar: {
    height: 72,
    borderRadius: 26,
    backgroundColor: 'rgba(5,5,5,0.96)',
    borderWidth: 1,
    borderColor: '#B026FF66',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: Ron1nColors.purple,
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 18,
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 74,
    height: 58,
    borderRadius: 20,
  },
  itemActive: {
    backgroundColor: '#00FF4112',
    borderWidth: 1,
    borderColor: '#00FF4133',
  },
  iconHalo: {
    width: 34,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconHaloActive: {
    backgroundColor: '#00FF4120',
  },
  label: {
    marginTop: 3,
    color: '#777',
    fontSize: 8,
    fontWeight: '900',
  },
  labelActive: {
    color: Ron1nColors.white,
  },
});