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

import Ron1nScreen from '../components/Ron1nScreen';
import Ron1nCard from '../components/Ron1nCard';
import { SEND_REVIEW_ASSETS, Ron1nAssetConfig } from '../config/assetCatalog';
import { ActivityService } from '../services/ActivityService';
import { ProviderFactory } from '../services/providers/ProviderFactory';
import { ChainProviderStatus } from '../services/providers/types';
import { Ron1nColors } from '../theme/ron1nTheme';

export default function SendScreen() {
  const [asset, setAsset] = useState<Ron1nAssetConfig>(
    SEND_REVIEW_ASSETS.find((item) => item.symbol === 'ETH') ?? SEND_REVIEW_ASSETS[0]
  );
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [providerStatus, setProviderStatus] = useState<ChainProviderStatus | null>(null);

  const openReview = async () => {
    if (!recipient.trim() || !amount.trim()) {
      Alert.alert('Missing Info', 'Enter recipient and amount first.');
      return;
    }

    try {
      const provider = ProviderFactory.getProvider(asset.symbol);
      const status = await provider.getStatus();
      const estimatedFee = await provider.estimateFee({
        chain: status.chain,
        asset: asset.symbol,
        from: 'local-wallet-address',
        to: recipient,
        amount,
      });

      setProviderStatus(status);

      await ActivityService.addActivity(
        'SEND_REVIEW',
        'Send Review Opened',
        `${amount} ${asset.symbol} to ${recipient.slice(0, 10)}... fee ${estimatedFee.toString()}`
      );

      setReviewOpen(true);
    } catch (error) {
      console.error('Send review failed:', error);
      Alert.alert('Review Failed', 'Unable to prepare send review.');
    }
  };

  const confirmSend = async () => {
    if (!acknowledged) {
      Alert.alert('Confirmation Required', 'Acknowledge the external transfer warning.');
      return;
    }

    const auth = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Confirm Shogun Send',
      fallbackLabel: 'Use device passcode',
    });

    if (!auth.success) {
      await ActivityService.addActivity(
        'SEND_BLOCKED',
        'Send Blocked',
        `${asset.symbol} biometric confirmation failed`
      );

      Alert.alert('Blocked', 'Biometric confirmation failed.');
      return;
    }

    await ActivityService.addActivity(
      'SEND_BLOCKED',
      'Send Not Broadcast Yet',
      `${amount} ${asset.symbol} reviewed. Broadcast engine not connected.`
    );

    setReviewOpen(false);
    setAcknowledged(false);

    Alert.alert(
      'Broadcast Not Live Yet',
      'Shogun Wallet review flow is active. Real network broadcasting will connect in a later build.'
    );
  };

  return (
    <Ron1nScreen>
      <SafeAreaView>
        <Text style={styles.title}>SEND ASSET</Text>
        <Text style={styles.subtitle}>
          Review-only flow. Ron1n does not custody, wrap, or convert assets.
        </Text>

        <Ron1nCard>
          <Text style={styles.label}>SELECT ASSET</Text>

          <TouchableOpacity style={styles.selectorButton} onPress={() => setSelectorOpen(true)}>
            <View>
              <Text style={styles.selectorSymbol}>{asset.symbol}</Text>
              <Text style={styles.selectorName}>{asset.name}</Text>
            </View>

            <Text style={styles.selectorCategory}>{asset.category}</Text>
          </TouchableOpacity>

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
            <Text style={styles.feeValue}>
              Estimated after live provider RPC is connected
            </Text>
          </View>

          <TouchableOpacity style={styles.reviewButton} onPress={openReview}>
            <Text style={styles.reviewButtonText}>REVIEW SEND</Text>
          </TouchableOpacity>
        </Ron1nCard>

        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>SECURITY LAYER NOTICE</Text>
          <Text style={styles.warningText}>
            Shogun Wallet helps protect keys, monitor exposure, and prepare assets for
            future quantum migration. External chain transfers still follow the destination
            network’s rules and visibility.
          </Text>
        </View>

        <Modal visible={selectorOpen} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>SELECT ASSET</Text>

              <ScrollView showsVerticalScrollIndicator={false}>
                {SEND_REVIEW_ASSETS.map((item) => (
                  <TouchableOpacity
                    key={item.symbol}
                    style={styles.assetOption}
                    onPress={() => {
                      setAsset(item);
                      setSelectorOpen(false);
                    }}
                  >
                    <View>
                      <Text style={styles.optionSymbol}>{item.symbol}</Text>
                      <Text style={styles.optionName}>{item.name}</Text>
                    </View>

                    <Text style={styles.optionCategory}>{item.category}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setSelectorOpen(false)}
              >
                <Text style={styles.cancelButtonText}>CANCEL</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={reviewOpen} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>REVIEW TRANSACTION</Text>

              <Text style={styles.reviewLine}>Asset: {asset.symbol}</Text>
              <Text style={styles.reviewLine}>Network: {asset.name}</Text>
              <Text style={styles.reviewLine}>Amount: {amount}</Text>
              <Text style={styles.reviewAddress}>To: {recipient}</Text>

              {providerStatus && (
                <View style={styles.providerBox}>
                  <Text style={styles.providerText}>
                    Provider: {providerStatus.family} / {providerStatus.mode}
                  </Text>
                  <Text style={styles.providerText}>{providerStatus.message}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.checkBox, acknowledged && styles.checkBoxActive]}
                onPress={() => setAcknowledged(!acknowledged)}
              >
                <Text style={styles.checkText}>
                  {acknowledged ? '✓ ' : ''}
                  I understand external transfers may be public and outside Ron1n’s
                  security-layer protections.
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.confirmButton} onPress={confirmSend}>
                <Text style={styles.confirmButtonText}>BIOMETRIC CONFIRM</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setReviewOpen(false)}
              >
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
  selectorButton: {
    borderWidth: 1,
    borderColor: '#00D4FF55',
    backgroundColor: '#00D4FF10',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectorSymbol: {
    color: Ron1nColors.blue,
    fontSize: 18,
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
  },
  selectorName: {
    color: '#AAAAAA',
    fontSize: 11,
    marginTop: 5,
  },
  selectorCategory: {
    color: Ron1nColors.green,
    fontSize: 10,
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
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
  feeLabel: {
    color: Ron1nColors.gray,
    fontSize: 9,
    fontFamily: 'KatakanaStyle',
  },
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
    borderColor: Ron1nColors.gold,
    backgroundColor: '#1A1300',
    borderRadius: 18,
    padding: 16,
  },
  warningTitle: {
    color: Ron1nColors.gold,
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
    maxHeight: '84%',
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
    marginBottom: 12,
  },
  assetOption: {
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    paddingVertical: 13,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionSymbol: {
    color: Ron1nColors.green,
    fontSize: 14,
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
  },
  optionName: {
    color: '#AAAAAA',
    fontSize: 11,
    marginTop: 4,
  },
  optionCategory: {
    color: Ron1nColors.blue,
    fontSize: 9,
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
  providerBox: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#111',
  },
  providerText: {
    color: Ron1nColors.gray,
    fontSize: 10,
    lineHeight: 16,
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
  cancelButton: {
    padding: 15,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: Ron1nColors.gray,
    fontFamily: 'KatakanaStyle',
  },
});