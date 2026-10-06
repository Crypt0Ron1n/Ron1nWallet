import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  PressableProps,
  StyleSheet,
} from 'react-native';

type Props = PressableProps & {
  children: React.ReactNode;
};

export default function Ron1nPressable({
  children,
  style,
  onPressIn,
  onPressOut,
  ...props
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = (event: any) => {
    Animated.spring(scale, {
      toValue: 0.975,
      useNativeDriver: true,
      speed: 24,
      bounciness: 4,
    }).start();

    onPressIn?.(event);
  };

  const pressOut = (event: any) => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 24,
      bounciness: 6,
    }).start();

    onPressOut?.(event);
  };

  return (
    <Animated.View style={styles.wrapper}>
      <Pressable
        {...props}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    transform: [{ scale: 1 }],
  },
});

