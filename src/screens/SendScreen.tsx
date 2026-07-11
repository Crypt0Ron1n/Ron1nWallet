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
import { FeeQuoteService } from '../services/fees/FeeQuoteService';
import { FeeQuote, SendMode } from '../services/fees/types';
import { ProviderFactory } from '../services/providers/ProviderFactory';
import { ChainProviderStatus } from '../services/providers/types';
import { SecurityPolicyService } from '../services/SecurityPolicyService';
import { Ron1nColors } from '../theme/ron1nTheme';

export default function SendScreen() {
  const [asset, setAsset] = useState<Ron1nAssetConfig>(
    SEND_REVIEW_ASSETS.find((item) => item.symbol === 'ETH') ?? SEND_REVIEW_ASSETS[0]
  );

  const [selectorOpen, setSelectorOpen] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [amountUsd, setAmountUsd] = useState('');
  const [estimatedFeeUsd, setEstimatedFeeUsd] = useState('1.00');
  const [sendMode, setSendMode] = useState<SendMode>('EXACT_SEND');

  const [reviewOpen, setReviewOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [providerStatus, setProviderStatus] = useState<ChainProviderStatus | null>(null);
  const [feeQuote, setFeeQuote] = useState<FeeQuote | null>(null);

  const createPreviewQuote = () => {
    if (!amountUsd.trim()) return null;

    return FeeQuoteService.createQuote({
      asset: asset.symbol,
      network: asset.name,
      amountUsd,
      estimatedFeeUsd,
      sendMode,
    });
  };

  const openReview = async () => {
    if (!recipient.trim() || !amountUsd.trim()) {
      Alert.alert('Missing Info', 'Enter recipient and amount first.');
      return;
    }

    try {
      const provider = ProviderFactory.getProvider(asset.symbol);
      const status = await provider.getStatus();

      await provider.estimateFee({
        chain: status.chain,
        asset: asset.symbol,
        from: 'local-wallet-address',
        to: recipient,
        amount: amountUsd,
      });

      const quote = FeeQuoteService.createQuote({
        asset: asset.symbol,
        network: asset.name,
        amountUsd,
        estimatedFeeUsd,
        sendMode,
      });

      setProviderStatus(status);
      setFeeQuote(quote);

      await ActivityService.addActivity(
        'SEND_REVIEW',
        'Send Review Opened',
        `${asset.symbol} ${sendMode} review prepared. Network fee estimate $${quote.estimatedFeeUsd}`
      );

      setReviewOpen(true);
    } catch (error) {
      console.error('Send review failed:', error);
      Alert.alert('Review Failed', 'Unable to prepare send review.');
    }
  };

  const confirmSendReview = async () => {
    if (!feeQuote) {
      Alert.alert('Missing Review', 'Prepare a fee quote first.');
      return;
    }

    if (!acknowledged) {
      Alert.alert('Confirmation Required', 'Acknowledge the network fee disclosure.');
      return;
    }

    const auth = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Confirm Shogun Send Review',
      fallbackLabel: 'Use device passcode',
    });

    if (!auth.success) {
      await ActivityService.addActivity(
        'SEND_BLOCKED',
        'Send Review Blocked',
        `${asset.symbol} biometric confirmation failed`
      );

      Alert.alert('Blocked', 'Biometric confirmation failed.');
      return;
    }

    await ActivityService.addActivity(
      'SEND_REVIEW',
      'Fee Review Confirmed',
      `${asset.symbol} recipient $${feeQuote.recipientReceivesUsd}. Network fee $${feeQuote.estimatedFeeUsd}.`
    );

    setReviewOpen(false);
    setAcknowledged(false);

    Alert.alert(
      'Review Complete',
      'This build reviews fees and security only. Real blockchain broadcasting will be added after privacy and safety layers are complete.'
    );
  };

  const previewQuote = createPreviewQuote();

  return (
    <Ron1nScreen>
      <SafeAreaView>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>SEND REVIEW</Text>

          <Text style={styles.subtitle}>
            Review-only flow. No blockchain transaction is broadcast from this screen.
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

            <Text style={styles.label}>SEND MODE</Text>

            <View style={styles.modeRow}>
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  sendMode === 'EXACT_SEND' && styles.modeButtonActive,
                ]}
                onPress={() => setSendMode('EXACT_SEND')}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    sendMode === 'EXACT_SEND' && styles.modeButtonTextActive,
                  ]}
                >
                  EXACT SEND
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modeButton,
                  sendMode === 'SPEND_TOTAL' && styles.modeButtonActive,
                ]}
                onPress={() => setSendMode('SPEND_TOTAL')}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    sendMode === 'SPEND_TOTAL' && styles.modeButtonTextActive,
                  ]}
                >
                  SPEND TOTAL
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modeHelp}>
              {sendMode === 'EXACT_SEND'
                ? 'Recipient receives the entered amount. Network fee is added on top.'
                : 'You spend the entered total. Network fee reduces what recipient receives.'}
            </Text>

            <Text style={styles.label}>RECIPIENT</Text>
            <TextInput
              style={styles.input}
              value={recipient}
              onChangeText={setRecipient}
              placeholder="Paste address"
              placeholderTextColor="#555"
              autoCapitalize="none"
            />

            <Text style={styles.label}>AMOUNT USD</Text>
            <TextInput
              style={styles.input}
              value={amountUsd}
              onChangeText={setAmountUsd}
              placeholder="100.00"
              placeholderTextColor="#555"
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>ESTIMATED NETWORK FEE USD</Text>
            <TextInput
              style={styles.input}
              value={estimatedFeeUsd}
              onChangeText={setEstimatedFeeUsd}
              placeholder="1.00"
              placeholderTextColor="#555"
              keyboardType="decimal-pad"
            />

            {previewQuote && (
              <View style={styles.quoteBox}>
                <Text style={styles.quoteTitle}>FEE PREVIEW</Text>

                <View style={styles.quoteRow}>
                  <Text style={styles.quoteLabel}>Recipient receives</Text>
                  <Text style={styles.quoteValue}>${previewQuote.recipientReceivesUsd}</Text>
                </View>

                <View style={styles.quoteRow}>
                  <Text style={styles.quoteLabel}>Network fee</Text>
                  <Text style={styles.quoteValue}>${previewQuote.estimatedFeeUsd}</Text>
                </View>

                <View style={styles.quoteRow}>
                  <Text style={styles.quoteLabel}>Shogun fee</Text>
                  <Text style={styles.quoteValue}>${previewQuote.shogunFeeUsd}</Text>
                </View>

                <View style={styles.quoteRow}>
                  <Text style={styles.quoteLabel}>Ron1n fee</Text>
                  <Text style={styles.quoteValue}>${previewQuote.ron1nFeeUsd}</Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.quoteRow}>
                  <Text style={styles.quoteLabelStrong}>Total required</Text>
                  <Text style={styles.quoteValueStrong}>${previewQuote.totalRequiredUsd}</Text>
                </View>

                <Text style={styles.quoteWarning}>{previewQuote.warning}</Text>
              </View>
            )}

            <TouchableOpacity style={styles.reviewButton} onPress={openReview}>
              <Text style={styles.reviewButtonText}>REVIEW SEND</Text>
            </TouchableOpacity>
          </Ron1nCard>

          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>NETWORK FEE NOTICE</Text>
            <Text style={styles.warningText}>
              {SecurityPolicyService.getFeeDisclosure()}
            </Text>
          </View>

          <View style={styles.bottomSpace} />
        </ScrollView>

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

              {feeQuote && (
                <>
                  <Text style={styles.reviewLine}>Asset: {feeQuote.asset}</Text>
                  <Text style={styles.reviewLine}>Network: {feeQuote.network}</Text>
                  <Text style={styles.reviewLine}>
                    Mode: {feeQuote.sendMode === 'EXACT_SEND' ? 'Exact Send' : 'Spend Total'}
                  </Text>

                  <View style={styles.reviewBox}>
                    <View style={styles.quoteRow}>
                      <Text style={styles.quoteLabel}>Recipient receives</Text>
                      <Text style={styles.quoteValue}>${feeQuote.recipientReceivesUsd}</Text>
                    </View>

                    <View style={styles.quoteRow}>
                      <Text style={styles.quoteLabel}>Network fee</Text>
                      <Text style={styles.quoteValue}>${feeQuote.estimatedFeeUsd}</Text>
                    </View>

                    <View style={styles.quoteRow}>
                      <Text style={styles.quoteLabel}>Shogun fee</Text>
                      <Text style={styles.quoteValue}>${feeQuote.shogunFeeUsd}</Text>
                    </View>

                    <View style={styles.quoteRow}>
                      <Text style={styles.quoteLabel}>Ron1n fee</Text>
                      <Text style={styles.quoteValue}>${feeQuote.ron1nFeeUsd}</Text>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.quoteRow}>
                      <Text style={styles.quoteLabelStrong}>Total required</Text>
                      <Text style={styles.quoteValueStrong}>${feeQuote.totalRequiredUsd}</Text>
                    </View>

                    <Text style={styles.quoteWarning}>{feeQuote.warning}</Text>
                  </View>

                  <Text style={styles.reviewAddress}>To: {recipient}</Text>
                </>
              )}

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
                  I understand this fee is required by the selected blockchain network
                  and is not paid to Shogun Wallet.
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.confirmButton} onPress={confirmSendReview}>
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
  modeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#080808',
  },
  modeButtonActive: {
    borderColor: Ron1nColors.green,
    backgroundColor: '#00FF4115',
  },
  modeButtonText: {
    color: Ron1nColors.gray,
    fontSize: 9,
    fontWeight: '900',
    fontFamily: 'KatakanaStyle',
  },
  modeButtonTextActive: {
    color: Ron1nColors.green,
  },
  modeHelp: {
    color: '#AAAAAA',
    marginTop: 10,
    fontSize: 11,
    lineHeight: 17,
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
  quoteBox: {
    marginTop: 18,
    padding: 14,
    backgroundColor: '#111',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#00D4FF44',
  },
  quoteTitle: {
    color: Ron1nColors.blue,
    fontSize: 10,
    fontWeight: '900',
    marginBottom: 10,
    fontFamily: 'KatakanaStyle',
  },
  quoteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 10,
  },
  quoteLabel: {
    color: '#AAAAAA',
    fontSize: 11,
  },
  quoteLabelStrong: {
    color: Ron1nColors.white,
    fontSize: 12,
    fontWeight: '900',
  },
  quoteValue: {
    color: Ron1nColors.white,
    fontSize: 12,
    fontWeight: '900',
  },
  quoteValueStrong: {
    color: Ron1nColors.green,
    fontSize: 13,
    fontWeight: '900',
  },
  quoteWarning: {
    color: Ron1nColors.gold,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#333',
    marginTop: 12,
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
    maxHeight: '88%',
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
    marginTop: 12,
    fontFamily: 'KatakanaStyle',
  },
  reviewBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#00FF4144',
    backgroundColor: '#00FF410D',
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
  bottomSpace: {
    height: 110,
  },
});