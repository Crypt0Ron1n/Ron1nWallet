import React, { useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, withRepeat, withTiming, useAnimatedStyle } from 'react-native-reanimated';

export default function FlickerButton({ title, onPress, color }: any) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.4, { duration: 150 }), -1, true);
  }, []);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <TouchableOpacity onPress={onPress}>
      <Animated.View style={[styles.button, { borderColor: color }, animatedStyle]}>
        <Text style={[styles.text, { color }]}>{title}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}
const styles = StyleSheet.create({
  button: { paddingHorizontal: 20, paddingVertical: 12, borderWidth: 2, borderRadius: 8, backgroundColor: '#050505', alignItems: 'center' },
  text: { fontWeight: '900', fontFamily: 'KatakanaStyle', fontSize: 10 }
});