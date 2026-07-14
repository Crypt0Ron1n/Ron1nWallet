import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as LocalAuthentication from 'expo-local-authentication';

import Ron1nCard from '../components/Ron1nCard';
import Ron1nScreen from '../components/Ron1nScreen';
import { ActivityService, type Ron1nActivity } from '../services/transactions/ActivityService';
import { Ron1nColors } from '../theme/ron1nTheme';

export default function ActivityScreen() {
  const [activities, setActivities] = useState<Ron1nActivity[]>([]);

  const load = async () => {
    try {
      const data = await ActivityService.getActivities();
      setActivities(data);
    } catch (error) {
      console.error('Failed to load activity:', error);
      setActivities([]);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const clearActivity = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();

    if (hasHardware) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to Clear Local Activity',
        fallbackLabel: 'Use device passcode',
      });

      if (!result.success) {
        Alert.alert('Blocked', 'Authentication failed.');
        return;
      }
    }

    Alert.alert(
      'Clear Local Activity',
      'This clears the private local activity log on this device. It does not delete your wallet or affect public blockchain history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await ActivityService.clearActivities();
              setActivities([]);
              Alert.alert('Cleared', 'Local activity has been cleared.');
            } catch (error) {
              Alert.alert('Error', 'Unable to clear local activity.');
            }
          },
        },
      ]
    );
  };

  return (
    <Ron1nScreen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Image source={require('../../assets/rs-gold.png')} style={styles.logo} />
          <Text style={styles.title}>PRIVATE ACTIVITY</Text>
          <Text style={styles.subtitle}>LOCAL DEVICE LEDGER</Text>
        </View>

        <Ron1nCard>
          <Text style={styles.sectionTitle}>PRIVACY MODE</Text>
          <Text style={styles.body}>
            Private Activity is stored locally on this device. Chain Activity is
            only fetched when you manually sync public blockchain data.
          </Text>
        </Ron1nCard>

        <TouchableOpacity onPress={clearActivity} style={styles.clearButton}>
          <Text style={styles.clearText}>CLEAR LOCAL ACTIVITY</Text>
        </TouchableOpacity>

        {activities.length === 0 ? (
          <Ron1nCard>
            <Text style={styles.emptyTitle}>NO LOCAL ACTIVITY</Text>
            <Text style={styles.body}>
              Wallet actions, receive views, security scans, and manual sync
              events will appear here.
            </Text>
          </Ron1nCard>
        ) : (
          <View style={styles.list}>
            {activities.map((item) => (
              <Ron1nCard key={item.id}>
                <Text style={styles.activityType}>{item.type}</Text>
                <Text style={styles.activityTitle}>{item.title}</Text>
                <Text style={styles.body}>{item.detail}</Text>
                <Text style={styles.timestamp}>
                  {new Date(item.createdAt || Date.now()).toLocaleString()}
                </Text>
              </Ron1nCard>
            ))}
          </View>
        )}
      </ScrollView>
    </Ron1nScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 120,
  },
  header: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 18,
  },
  logo: {
    width: 108,
    height: 108,
    resizeMode: 'contain',
    marginBottom: 10,
  },
  title: {
    color: Ron1nColors.gold,
    fontSize: 23,
    fontWeight: '900',
    letterSpacing: 3,
  },
  subtitle: {
    color: Ron1nColors.green,
    fontSize: 10,
    letterSpacing: 3,
    marginTop: 6,
  },
  sectionTitle: {
    color: Ron1nColors.green,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 10,
  },
  body: {
    color: '#CCCCCC',
    fontSize: 12,
    lineHeight: 19,
  },
  clearButton: {
    marginBottom: 14,
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#FF4D4D66',
    backgroundColor: '#FF4D4D12',
    alignItems: 'center',
  },
  clearText: {
    color: '#FF7777',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
  emptyTitle: {
    color: Ron1nColors.gold,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 8,
  },
  list: {
    gap: 10,
  },
  activityType: {
    color: Ron1nColors.green,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 6,
  },
  activityTitle: {
    color: Ron1nColors.white,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 8,
  },
  timestamp: {
    color: '#777777',
    fontSize: 10,
    marginTop: 10,
  },
});