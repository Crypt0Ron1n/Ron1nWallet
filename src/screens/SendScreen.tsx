import React, { useState } from 'react';
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';

import Ron1nScreen from '../components/Ron1nScreen';
import Ron1nCard from '../components/Ron1nCard';
import { ActivityService } from '../services/ActivityService';
import { Ron1nColors } from '../theme/ron1nTheme';

const ASSETS = ['ETH', 'BTC', 'LTC', 'SOL'];

export default function SendScreen() {
  const [asset, setAsset] = useState('ETH');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const openReview = async () => {
    if (!recipient.trim() || !amount.trim()) {
      Alert.alert('Missing Info', 'Enter recipient and amount first.');
      return;
    }

    await ActivityService.addActivity(
      'SEND_REVIEW',
      'Send Review Opened',
      `${amount} ${asset} to ${recipient.slice(0, 10)}...`
    );

    setReviewOpen(true);
  };

  const confirmSend = async () => {
    if (!acknowledged) {
      Alert.alert('Confirmation Required', 'Acknowledge the external transfer warning.');
      return;
    }

    const auth = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Confirm Ron1n Send',
      fallbackLabel: 'Use device passcode',
    });

    if (!auth.success) {
      await ActivityService.addActivity(
        'SEND_BLOCKED',
        'Send Blocked',
        `${asset} biometric confirmation failed`
      );
      Alert.alert('Blocked', 'Biometric confirmation failed.');
      return;
    }

    await ActivityService.addActivity(
      'SEND_BLOCKED',
      'Send Not Broadcast Yet',
      `${amount} ${asset} reviewed. Broadcast engine not connected.`
    );

    setReviewOpen(false);
    setAcknowledged(false);

    Alert.alert('Send Engine Not Live Yet', 'Review flow is ready. Broadcast engine comes next.');
  };

  return (
    <Ron1nScreen>
      <SafeAreaView>
        <Text style={styles.title}>SEND ASSET</Text>
        <Text style={styles.subtitle}>External transfers are public-chain actions.</Text>

        <Ron1nCard>
          <Text style={styles.label}>ASSET</Text>
          <View style={styles.assetRow}>
            {ASSETS.map((item) => (
              <TouchableOpacity
                key={item}
                style={[styles.assetPill, asset === item && styles.assetPillActive]}
                onPress={() => setAsset(item)}
              >
                <Text style={[styles.assetPillText, asset === item && styles.assetPillTextActive]}>
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>RECIPIENT</Text>
          <TextInput
            style={styles.input}
            value={recipient}
            onChangeText={setRecipient}
            placeholder="Paste address"
            placeholderTextColor="#555"
            autoCapitalize="none"
          />

          <Text style={styles.label}>AMOUNT</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor="#555"
            keyboardType="decimal-pad"
          />

          <View style={styles.feeBox}>
            <Text style={styles.feeLabel}>NETWORK FEE</Text>
            <Text style={styles.feeValue}>Estimated after broadcast engine is connected</Text>
          </View>

          <TouchableOpacity style={styles.reviewButton} onPress={openReview}>
            <Text style={styles.reviewButtonText}>REVIEW SEND</Text>
          </TouchableOpacity>
        </Ron1nCard>

        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>PUBLIC CHAIN WARNING</Text>
          <Text style={styles.warningText}>
            Sending outside Ron1n moves the asset to the destination network security model.
            External transactions may be visible on public explorers.
          </Text>
        </View>

        <Modal visible={reviewOpen} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>REVIEW TRANSACTION</Text>

              <Text style={styles.reviewLine}>Asset: {asset}</Text>
              <Text style={styles.reviewLine}>Amount: {amount}</Text>
              <Text style={styles.reviewAddress}>To: {recipient}</Text>

              <TouchableOpacity
                style={[styles.checkBox, acknowledged && styles.checkBoxActive]}
                onPress={() => setAcknowledged(!acknowledged)}
              >
                <Text style={styles.checkText}>
                  {acknowledged ? '✓ ' : ''}
                  I understand this external transfer may be public and outside Ron1n protection.
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.confirmButton} onPress={confirmSend}>
                <Text style={styles.confirmButtonText}>BIOMETRIC CONFIRM</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelButton} onPress={() => setReviewOpen(false)}>
                <Text style={styles.cancelButtonText}>CANCEL</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </Ron1nScreen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: Ron1nColors.blue,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 3,
    fontFamily: 'KatakanaStyle',
    marginTop: 20,
  },
  subtitle: {
    color: Ron1nColors.gray,
    fontSize: 11,
    marginTop: 6,
    marginBottom: 24,
    fontFamily: 'KatakanaStyle',
  },
  label: {
    color: Ron1nColors.gray,
    fontSize: 9,
    letterSpacing: 2,
    marginBottom: 10,
    marginTop: 14,
    fontFamily: 'KatakanaStyle',
  },
  assetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  assetPill: {
    borderWidth: 1,
    borderColor: '#333',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  assetPillActive: {
    borderColor: Ron1nColors.green,
    backgroundColor: '#00FF4122',
  },
  assetPillText: {
    color: Ron1nColors.gray,
    fontSize: 11,
    fontFamily: 'KatakanaStyle',
  },
  assetPillTextActive: {
    color: Ron1nColors.green,
  },
  input: {
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 14,
    padding: 14,
    color: Ron1nColors.white,
    backgroundColor: '#080808',
    fontFamily: 'monospace',
  },
  feeBox: {
    marginTop: 18,
    padding: 14,
    backgroundColor: '#111',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#222',
  },
  feeLabel: { color: Ron1nColors.gray, fontSize: 9, fontFamily: 'KatakanaStyle' },
  feeValue: {
    color: Ron1nColors.green,
    fontSize: 11,
    marginTop: 6,
    fontFamily: 'KatakanaStyle',
  },
  reviewButton: {
    marginTop: 24,
    backgroundColor: Ron1nColors.purple,
    padding: 15,
    borderRadius: 16,
    alignItems: 'center',
  },
  reviewButtonText: {
    color: Ron1nColors.white,
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
    fontSize: 12,
  },
  warningCard: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: Ron1nColors.red,
    backgroundColor: '#22000A',
    borderRadius: 18,
    padding: 16,
  },
  warningTitle: {
    color: Ron1nColors.red,
    fontSize: 11,
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
  },
  warningText: {
    color: '#CCCCCC',
    fontSize: 11,
    lineHeight: 18,
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#0A0A0A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: Ron1nColors.purple,
  },
  modalTitle: {
    color: Ron1nColors.white,
    fontSize: 18,
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
  },
  reviewLine: {
    color: Ron1nColors.green,
    marginTop: 14,
    fontFamily: 'KatakanaStyle',
  },
  reviewAddress: {
    color: Ron1nColors.purple,
    marginTop: 14,
    fontFamily: 'monospace',
  },
  checkBox: {
    marginTop: 22,
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 14,
    padding: 14,
  },
  checkBoxActive: {
    borderColor: Ron1nColors.green,
    backgroundColor: '#00FF4115',
  },
  checkText: {
    color: '#CCCCCC',
    fontSize: 12,
    lineHeight: 18,
  },
  confirmButton: {
    marginTop: 18,
    backgroundColor: Ron1nColors.green,
    padding: 15,
    borderRadius: 16,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#000',
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
  },
  cancelButton: { padding: 15, alignItems: 'center' },
  cancelButtonText: { color: Ron1nColors.gray, fontFamily: 'KatakanaStyle' },
});