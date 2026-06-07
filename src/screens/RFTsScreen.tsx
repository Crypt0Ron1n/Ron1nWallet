import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RFTsScreen() { // <-- Change this name per file
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.text}>RFTs Screen</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#00FF41',
    fontFamily: 'KatakanaStyle',
    fontSize: 16,
  }
});