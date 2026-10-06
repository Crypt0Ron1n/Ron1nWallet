import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

export default function Ron1nScreen({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces
        decelerationRate="fast"
        scrollEventThrottle={16}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    padding: 20,
    paddingBottom: 120,
    backgroundColor: '#000000',
  },
});

