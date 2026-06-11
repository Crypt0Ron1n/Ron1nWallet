import React, { useRef } from 'react';
import { Animated, Pressable, PressableProps } from 'react-native';

type Props = PressableProps & {
  children: React.ReactNode;
};

export default function Ron1nPressable({ children, style, onPressIn, onPressOut, ...props }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = (e: any) => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 24,
      bounciness: 6,
    }).start();

    onPressIn?.(e);
  };

  const pressOut = (e: any) => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 24,
      bounciness: 8,
    }).start();

    onPressOut?.(e);
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
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