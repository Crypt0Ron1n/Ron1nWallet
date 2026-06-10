import React, { useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityService } from '../services/ActivityService';

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
      Alert.alert('Confirmation Required', 'You must acknowledge the external transfer warning.');
      return;
    }

    const auth = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Confirm Ron1n Send',
      fallbackLabel: 'Use device passcode',
    });

    if (!auth.success) {
      await ActivityService.addActivity('SEND_BLOCKED', 'Send Blocked', `${asset} biometric confirmation failed`);
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

    Alert.alert(
      'Send Engine Not Live Yet',
      'This review flow is ready, but real blockchain broadcasting is not enabled yet.'
    );
  };

  return (
    <LinearGradient colors={['#050505', '#0A0014', '#050505']} style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>SEND ASSET</Text>
          <Text style={styles.subtitle}>External transfers are public-chain actions.</Text>

          <View style={styles.card}>
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
          </View>

          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>PUBLIC CHAIN WARNING</Text>
            <Text style={styles.warningText}>
              Sending outside Ron1n moves the asset to the destination network security model.
              External transactions may be visible on public explorers.
            </Text>
          </View>
        </ScrollView>

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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1, padding: 20 },
  title: {
    color: '#B026FF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 3,
    fontFamily: 'KatakanaStyle',
    marginTop: 20,
  },
  subtitle: {
    color: '#777',
    fontSize: 11,
    marginTop: 6,
    marginBottom: 24,
    fontFamily: 'KatakanaStyle',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 22,
    padding: 20,
  },
  label: {
    color: '#555',
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
    borderColor: '#00FF41',
    backgroundColor: '#00FF4122',
  },
  assetPillText: {
    color: '#777',
    fontSize: 11,
    fontFamily: 'KatakanaStyle',
  },
  assetPillTextActive: {
    color: '#00FF41',
  },
  input: {
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    backgroundColor: '#080808',
    fontFamily: 'monospace',
  },
  feeBox: {
    marginTop: 18,
    padding: 14,
    backgroundColor: '#111',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  feeLabel: { color: '#555', fontSize: 9, fontFamily: 'KatakanaStyle' },
  feeValue: { color: '#00FF41', fontSize: 11, marginTop: 6, fontFamily: 'KatakanaStyle' },
  reviewButton: {
    marginTop: 24,
    backgroundColor: '#B026FF',
    padding: 15,
    borderRadius: 14,
    alignItems: 'center',
  },
  reviewButtonText: {
    color: '#fff',
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
    fontSize: 12,
  },
  warningCard: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#FF3366',
    backgroundColor: '#22000A',
    borderRadius: 16,
    padding: 16,
  },
  warningTitle: { color: '#FF3366', fontSize: 11, fontWeight: '900', fontFamily: 'KatakanaStyle' },
  warningText: { color: '#ccc', fontSize: 11, lineHeight: 18, marginTop: 8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#0A0A0A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#B026FF',
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '900', fontFamily: 'KatakanaStyle' },
  reviewLine: { color: '#00FF41', marginTop: 14, fontFamily: 'KatakanaStyle' },
  reviewAddress: { color: '#B026FF', marginTop: 14, fontFamily: 'monospace' },
  checkBox: {
    marginTop: 22,
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 12,
    padding: 14,
  },
  checkBoxActive: { borderColor: '#00FF41', backgroundColor: '#00FF4115' },
  checkText: { color: '#ccc', fontSize: 12, lineHeight: 18 },
  confirmButton: {
    marginTop: 18,
    backgroundColor: '#00FF41',
    padding: 15,
    borderRadius: 14,
    alignItems: 'center',
  },
  confirmButtonText: { color: '#000', fontWeight: '900', fontFamily: 'KatakanaStyle' },
  cancelButton: { padding: 15, alignItems: 'center' },
  cancelButtonText: { color: '#888', fontFamily: 'KatakanaStyle' },
});