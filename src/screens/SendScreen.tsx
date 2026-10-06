import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
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
import Ron1nScreen from '../components/Ron1nScreen';
import Ron1nCard from '../components/Ron1nCard';
import Ron1nScreenHeader from '../components/Ron1nScreenHeader';
import Ron1nButton from '../components/Ron1nButton';
import Ron1nStatusBadge from '../components/Ron1nStatusBadge';
import KeyRotationModal from '../components/KeyRotationModal';
import { SEND_REVIEW_ASSETS, Ron1nAssetConfig, resolveNetworkIdentifier } from '../config/assetCatalog';
import { ActivityService } from '../services/transactions/ActivityService';
import { FeeQuoteService } from '../services/fees/FeeQuoteService';
import { FeeQuote, SendMode } from '../services/fees/types';
import { ProviderFactory } from '../services/providers/ProviderFactory';
import { EvmProvider } from '../services/providers/EvmProvider';
import { AssetAmountService } from '../services/assets/AssetAmountService';
import { TransactionSecurityGateService } from '../services/transactions/TransactionSecurityGateService';
import { TransactionConstructionService } from '../services/transactions/TransactionConstructionService';
import { SigningAuthorizationService } from '../services/crypto/SigningAuthorizationService';
import { TransactionSigningService } from '../services/crypto/TransactionSigningService';
import { BroadcastAuthorizationService } from '../services/crypto/BroadcastAuthorizationService';
import { BroadcastService } from '../services/transactions/BroadcastService';
import { WalletService } from '../services/WalletService';
import { ChainProviderStatus } from '../services/providers/types';
import { SecurityPolicyService } from '../services/SecurityPolicyService';
import type { SecurityPolicyResult } from '../services/SecurityPolicyEngine';
import type { TransactionIntent } from '../services/transactions/TransactionIntent';
import type { SignedPayload } from '../services/crypto/types';
import { Ron1nColors, type Ron1nStatusTone } from '../theme/ron1nTheme';
import { ProtectBeforeSendService } from '../services/security/ProtectBeforeSendService';
import { IdentityRegistryService } from '../services/identity/IdentityRegistryService';

function policyDecisionTone(decision: SecurityPolicyResult['decision']): Ron1nStatusTone {
  if (decision === 'ALLOW') return 'success';
  if (decision === 'BLOCK') return 'danger';
  return 'warning';
}

export default function SendScreen() {
  const [asset, setAsset] = useState<Ron1nAssetConfig>(
    SEND_REVIEW_ASSETS.find((item) => item.symbol === 'ETH') ?? SEND_REVIEW_ASSETS[0]
  );

  const [selectorOpen, setSelectorOpen] = useState(false);
  const [rotationModalOpen, setRotationModalOpen] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [amountAsset, setAmountAsset] = useState('');
  const [amountUsd, setAmountUsd] = useState('');
  const [estimatedFeeUsd, setEstimatedFeeUsd] = useState('1.00');
  const [networkFeeEth, setNetworkFeeEth] = useState<string | null>(null);
  const [rotationNeeded, setRotationNeeded] = useState(false);
  const [sendMode, setSendMode] = useState<SendMode>('EXACT_SEND');
  const [securityProfile, setSecurityProfile] = useState<'STANDARD' | 'PROTECTED' | 'MAXIMUM'>('STANDARD');

  const [reviewOpen, setReviewOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [providerStatus, setProviderStatus] = useState<ChainProviderStatus | null>(null);
  const [feeQuote, setFeeQuote] = useState<FeeQuote | null>(null);
  const [policyResult, setPolicyResult] = useState<SecurityPolicyResult | null>(null);
  const [transactionIntent, setTransactionIntent] = useState<TransactionIntent | null>(null);
  const [transactionDigest, setTransactionDigest] = useState<string | null>(null);
  const [transactionConstruction, setTransactionConstruction] = useState<Awaited<
    ReturnType<typeof TransactionConstructionService.prepare>
  > | null>(null);

  const normalizeAssetAmount = (value: string): string => {
    let normalized = value
      .trim()
      .replace(/[$,\s]/g, '')
      .replace(/[A-Za-z]+$/g, '')
      .trim();

    // Accept shorthand decimal input such as ".0053" and canonicalize it
    // to "0.0053" before the transaction intent reaches strict validation.
    if (normalized.startsWith('.')) {
      normalized = `0${normalized}`;
    }

    if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(normalized)) {
      throw new Error(
        `Invalid ${asset.symbol} amount: ${JSON.stringify(value)}`
      );
    }

    const [whole, fraction = ''] = normalized.split('.');
    const significant = `${whole}${fraction}`.replace(/^0+/, '');

    if (!significant || BigInt(significant) <= 0n) {
      throw new Error(
        `Invalid ${asset.symbol} amount: ${JSON.stringify(value)}`
      );
    }

    return normalized;
  };
  const createPreviewQuote = () => {
    if (!amountAsset.trim()) return null;

    return FeeQuoteService.createQuote({
      asset: asset.symbol,
      network: resolveNetworkIdentifier(asset),
      amountUsd: amountAsset,
      estimatedFeeUsd,
      sendMode,
    });
  };

  const resolveCurrentAddress = async (): Promise<string> => {
    const symbol = asset.symbol.toUpperCase();

    switch (symbol) {
      case 'BTC':
        return (await WalletService.getBitcoinWallet(0)).address;
      case 'LTC':
        return (await WalletService.getLitecoinWallet(0)).address;
      case 'SOL':
        return (await WalletService.getSolanaWallet(0)).address;
      case 'XRP':
        return (await WalletService.getXrpWallet(0)).address;
      case 'XLM':
        return (await WalletService.getStellarWallet(0)).address;
      case 'ALGO':
        return (await WalletService.getAlgorandWallet(0)).address;
      default: {
        const activeSpendIdentity = await IdentityRegistryService.findActive(
          'primary',
          'EVM',
          'SPEND'
        );

        if (activeSpendIdentity) {
          return activeSpendIdentity.address;
        }

        return (await WalletService.getEthereumWallet(0)).address;
      }
    }
  };

  useEffect(() => {
    let cancelled = false;

    const checkRotation = async () => {
      if (asset.symbol.toUpperCase() !== 'ETH') {
        if (!cancelled) setRotationNeeded(false);
        return;
      }

      try {
        const currentAddress = await resolveCurrentAddress();
        const protection = await ProtectBeforeSendService.assess('primary', 'EVM', currentAddress);
        const needsRotation =
          protection.status === 'REQUIRED' ||
          protection.status === 'UNREGISTERED' ||
          protection.status === 'BLOCKED';

        if (!cancelled) setRotationNeeded(needsRotation);
      } catch {
        if (!cancelled) setRotationNeeded(false);
      }
    };

    void checkRotation();

    return () => {
      cancelled = true;
    };
  }, [asset.symbol]);

  const openReview = async () => {
    if (!recipient.trim() || !amountAsset.trim()) {
      Alert.alert('Missing Info', `Enter recipient and ${asset.symbol} amount first.`);
      return;
    }

    try {
      const normalizedAmount = normalizeAssetAmount(amountAsset);
      const currentAddress = await resolveCurrentAddress();

      const gate = await TransactionSecurityGateService.evaluate({
        accountId: 'primary',
        assetSymbol: asset.symbol,
        network: resolveNetworkIdentifier(asset),
        from: currentAddress,
        to: recipient,
        amount: normalizedAmount,
        amountUnit: asset.category === 'Token' ? 'TOKEN' : 'NATIVE',
        fiatAmountUsd: amountUsd.trim() || undefined,
        sendMode,
        securityProfile,
        ...(asset.chainId !== undefined ? { chainId: asset.chainId } : {}),
      });

      const provider = ProviderFactory.getProvider(asset.symbol);
      const status = gate.providerStatus;

      let feeWei: bigint;

      if (gate.intent.amountUnit === 'TOKEN') {
        // Token fee preview must reflect the real transfer being built, not
        // the native 21,000-gas assumption. This calls the exact same
        // encoder/estimator ChainAdapterFactory uses for construction, so
        // preview and signing can never disagree on gas limit. If estimation
        // fails here, the preview fails closed rather than showing a
        // misleading fixed value.
        if (
          !(provider instanceof EvmProvider) ||
          !gate.intent.asset.tokenContract ||
          gate.intent.asset.decimals === undefined
        ) {
          throw new Error(
            `${asset.symbol} fee preview blocked: token contract or decimals are unresolved.`
          );
        }

        const tokenAmountBaseUnits = AssetAmountService.decimalToBaseUnits(
          normalizedAmount,
          gate.intent.asset.decimals
        );
        const data = EvmProvider.encodeErc20Transfer(recipient, tokenAmountBaseUnits);

        const [gasLimit, gasPriceWei] = await Promise.all([
          provider.estimateErc20TransferGas(gate.intent.from, gate.intent.asset.tokenContract, data),
          provider.getGasPriceWei(),
        ]);

        feeWei = gasLimit * gasPriceWei;
      } else {
        feeWei = await provider.estimateFee({
          chain: status.chain,
          asset: asset.symbol,
          from: gate.intent.from,
          to: recipient,
          amount: normalizedAmount,
        });
      }

      const liveFeeEth = ethers.formatEther(feeWei);
      setNetworkFeeEth(liveFeeEth);
      setEstimatedFeeUsd(liveFeeEth);

      const quote = FeeQuoteService.createQuote({
        asset: asset.symbol,
        network: resolveNetworkIdentifier(asset),
        amountUsd: normalizedAmount,
        estimatedFeeUsd: liveFeeEth,
        sendMode,
      });

      const construction = await TransactionConstructionService.prepare(gate.intent);

      setProviderStatus(status);
      setFeeQuote(quote);
      setPolicyResult(gate.policy);
      setTransactionIntent(gate.intent);
      setTransactionDigest(construction.transactionDigest);
      setTransactionConstruction(construction);

      await ActivityService.addActivity(
        'SEND_REVIEW',
        'Send Review Opened',
        `${asset.symbol} ${sendMode} review prepared. Policy ${gate.policy.decision}. Network fee estimate $${quote.estimatedFeeUsd}`
      );

      setReviewOpen(true);
    } catch (error) {
      console.error('Send review failed:', error);

      const message =
        error instanceof Error ? error.message : String(error);

      Alert.alert('Review Failed', message);
    }
  };

  const executeFinalSend = async (
    intent: TransactionIntent,
    construction: Awaited<ReturnType<typeof TransactionConstructionService.prepare>>,
    policy: SecurityPolicyResult,
    derivationIndex: number
  ): Promise<void> => {
    const authorizationResult = await SigningAuthorizationService.authorize(
      intent,
      policy,
      construction.transactionDigest
    );

    if (!authorizationResult.authorized) {
      await ActivityService.addActivity(
        'SEND_BLOCKED',
        'Signing Authorization Blocked',
        `${asset.symbol} ${authorizationResult.reason}`
      );
      Alert.alert('Authorization Blocked', authorizationResult.reason);
      return;
    }

    try {
      const signed: SignedPayload = await TransactionSigningService.sign({
        intent,
        construction,
        authorization: authorizationResult.authorization,
        derivationRef: { index: derivationIndex },
      });

      if (signed.chain !== 'EVM' || signed.kind !== 'RAW_TRANSACTION') {
        throw new Error('Unexpected EVM signing result.');
      }

      await ActivityService.addActivity(
        'SEND_REVIEW',
        'Transaction Signed',
        `${asset.symbol} transaction passed independent serialization verification. Preparing explicit broadcast authorization.`
      );

      const broadcastAuthorizationResult = await BroadcastAuthorizationService.authorize(
        intent,
        signed
      );

      if (!broadcastAuthorizationResult.authorized) {
        await ActivityService.addActivity(
          'SEND_BLOCKED',
          'Broadcast Authorization Blocked',
          `${asset.symbol} ${broadcastAuthorizationResult.reason}`
        );
        Alert.alert('Broadcast Not Authorized', broadcastAuthorizationResult.reason);
        return;
      }

      const broadcastResult = await BroadcastService.broadcast(
        intent,
        signed,
        broadcastAuthorizationResult.authorization
      );
      const reconciliation = broadcastResult.reconciliation;

      if (reconciliation.status === 'CONFIRMED') {
        await ActivityService.addActivity(
          'SEND_REVIEW',
          'Transaction Confirmed',
          `${asset.symbol} ${broadcastResult.transactionHash} confirmed in block ${reconciliation.blockNumber ?? 'unknown'} with ${reconciliation.confirmations ?? 0} confirmation(s).`
        );
        Alert.alert(
          'Transaction Confirmed',
          `Broadcast accepted and the transaction was confirmed.\n\nTX: ${broadcastResult.transactionHash}\nBlock: ${reconciliation.blockNumber ?? 'unknown'}\nConfirmations: ${reconciliation.confirmations ?? 0}\n\nRecommended: rotate to a fresh address now, before you receive again.`
        );
      } else if (reconciliation.status === 'PENDING') {
        await ActivityService.addActivity(
          'SEND_REVIEW',
          'Transaction Broadcast Pending',
          `${asset.symbol} broadcast accepted. Transaction ${broadcastResult.transactionHash} has not been mined yet.`
        );
        Alert.alert(
          'Broadcast Accepted',
          `The transaction was accepted by the network but is still pending confirmation.\n\nTX: ${broadcastResult.transactionHash}`
        );
      } else if (reconciliation.status === 'UNKNOWN') {
        // UNKNOWN means the provider could not locate the transaction yet -
        // it is not proof of failure. Telling the user it failed here would
        // be exactly the false negative that caused the known stuck-transaction
        // incident. Keep it visible as unresolved, not failed.
        await ActivityService.addActivity(
          'SEND_REVIEW',
          'Transaction Status Unknown',
          `${asset.symbol} transaction ${broadcastResult.transactionHash} was accepted but could not be located by the provider yet. This does not mean it failed - reconcile again shortly.`
        );
        Alert.alert(
          'Status Unknown',
          `The transaction was accepted but the network provider could not locate it yet. This does not mean it failed - check back shortly.\n\nTX: ${broadcastResult.transactionHash}`
        );
      } else {
        await ActivityService.addActivity(
          'SEND_BLOCKED',
          'Transaction Failed On-Chain',
          `${asset.symbol} transaction ${broadcastResult.transactionHash} was mined with a failed execution status.`
        );
        Alert.alert(
          'Transaction Failed',
          `The transaction was broadcast but the network reported a failed execution status.\n\nTX: ${broadcastResult.transactionHash}`
        );
      }
    } catch (error) {
      console.error('Transaction signing/broadcast failed:', error);
      await ActivityService.addActivity(
        'SEND_BLOCKED',
        'Transaction Execution Blocked',
        `${asset.symbol} signing or broadcast failed before a confirmed outbound transaction.`
      );
      Alert.alert(
        'Transaction Blocked',
        error instanceof Error ? error.message : 'The transaction did not pass execution checks. Nothing was broadcast unless the network already accepted the exact signed payload.'
      );
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

    if (!policyResult || !transactionIntent || policyResult.decision === 'BLOCK') {
      await ActivityService.addActivity(
        'SEND_BLOCKED',
        'Send Blocked by Security Policy',
        `${asset.symbol} policy ${policyResult?.decision ?? 'UNKNOWN'}: ${policyResult?.reasonCodes.join(', ') ?? 'No policy result'}`
      );
      Alert.alert(
        'Security Policy Blocked',
        policyResult
          ? `This transaction cannot proceed.\n\n${policyResult.reasonCodes.join(' • ')}`
          : 'Security policy evaluation is required before authorization.'
      );
      return;
    }

    setReviewOpen(false);
    setAcknowledged(false);

    try {
      const currentAddress = transactionIntent.from;
      const protection = await ProtectBeforeSendService.assess(
        transactionIntent.accountId,
        transactionIntent.asset.chain,
        currentAddress
      );

      const rotationRequired =
        protection.status === 'REQUIRED' ||
        protection.status === 'UNREGISTERED' ||
        protection.status === 'BLOCKED' ||
        policyResult.requiresRotation ||
        policyResult.requiresMigration;

      if (rotationRequired) {
        await ActivityService.addActivity(
          'SEND_BLOCKED',
          'Send Blocked: Rotation Required',
          `${asset.symbol} address ${currentAddress} has received funds and must be rotated to a fresh address before it can send. ${protection.reason}`
        );
        Alert.alert(
          'Rotate Address First',
          `This address has received funds and can't send directly.\n\nTap "INSPECT & ROTATE KEYS" above and use "ROTATE ADDRESS NOW" to sweep your balance to a fresh address, then try sending again.`
        );
        return;
      }

      if (protection.status === 'BLOCKED') {
        Alert.alert('Outbound Blocked', protection.reason);
        return;
      }

      if (!transactionConstruction || !transactionDigest) {
        Alert.alert('Signing Blocked', 'The transaction construction artifact is no longer available.');
        return;
      }

      if (asset.symbol !== 'ETH' || transactionIntent.asset.chain !== 'EVM') {
        Alert.alert(
          'Signing Not Enabled',
          `${asset.symbol} transaction signing remains disabled until its chain serialization and derivation are independently validated.`
        );
        return;
      }

      const sourceIdentity = protection.sourceIdentity;
      if (!sourceIdentity || sourceIdentity.purpose !== 'SPEND') {
        Alert.alert('Outbound Blocked', 'An active SPEND identity is required before outbound authorization.');
        return;
      }

      await executeFinalSend(
        transactionIntent,
        transactionConstruction,
        policyResult,
        sourceIdentity?.index ?? 0
      );
    } catch (error) {
      console.error('Send confirmation failed:', error);

      const message =
        error instanceof Error ? error.message : String(error);

      await ActivityService.addActivity(
        'SEND_BLOCKED',
        'Send Confirmation Failed',
        `${asset.symbol} ${message}`
      );

      Alert.alert('Send Failed', message);
    } finally {
      setTransactionConstruction(null);
      setTransactionDigest(null);
    }
  };

  const previewQuote = createPreviewQuote();

  return (
    <Ron1nScreen>
      <SafeAreaView>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Ron1nScreenHeader
            title="SEND REVIEW"
            subtitle="Reviewed, confirmed, signed, and verified before anything reaches the network"
            accent="blue"
          />

          <Ron1nCard>
            <Text style={styles.label}>SELECT ASSET & KEY HYGIENE</Text>

            <TouchableOpacity style={styles.selectorButton} onPress={() => setSelectorOpen(true)}>
              <View>
                <Text style={styles.selectorSymbol}>{asset.symbol}</Text>
                <Text style={styles.selectorName}>{asset.name}</Text>
              </View>

              <Text style={styles.selectorCategory}>{asset.category}</Text>
            </TouchableOpacity>

            {rotationNeeded && (
              <View style={styles.rotationWarningBox}>
                <Text style={styles.rotationWarningText}>
                  This address has received funds and must be rotated to a fresh address before
                  it can send. Why: sending exposes this address's public key on-chain, which
                  would permanently link everything it has ever received to this outgoing
                  transaction. Tap "INSPECT & ROTATE KEYS" below, then "ROTATE ADDRESS NOW" to
                  sweep your balance to a fresh address first.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.rotationTriggerButton}
              onPress={() => setRotationModalOpen(true)}
            >
              <Text style={styles.rotationTriggerText}>INSPECT & ROTATE KEYS</Text>
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

            <Text style={styles.label}>SECURITY PROFILE</Text>
            <View style={styles.modeRow}>
              {(['STANDARD', 'PROTECTED', 'MAXIMUM'] as const).map((profile) => (
                <TouchableOpacity
                  key={profile}
                  style={[
                    styles.modeButton,
                    securityProfile === profile && styles.modeButtonActive,
                  ]}
                  onPress={() => setSecurityProfile(profile)}
                >
                  <Text
                    style={[
                      styles.modeButtonText,
                      securityProfile === profile && styles.modeButtonTextActive,
                    ]}
                  >
                    {profile}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.modeHelp}>
              Standard evaluates exposure. Protected requires rotation when exposure is unknown or elevated. Maximum requires rotation and migration.
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

            <Text style={styles.label}>AMOUNT {asset.symbol}</Text>
            <TextInput
              style={styles.input}
              value={amountAsset}
              onChangeText={setAmountAsset}
              placeholder={`0.00 ${asset.symbol}`}
              placeholderTextColor="#555"
              keyboardType="decimal-pad"
              autoCapitalize="none"
            />

            <Text style={styles.amountHelp}>
              Enter the exact quantity of {asset.symbol} to send. This is the blockchain amount, not a USD value.
            </Text>

            <Text style={styles.label}>OPTIONAL USD DISPLAY VALUE</Text>
            <TextInput
              style={styles.input}
              value={amountUsd}
              onChangeText={setAmountUsd}
              placeholder="100.00"
              placeholderTextColor="#555"
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>NETWORK FEE</Text>
            <View style={styles.input}>
              <Text style={{ color: Ron1nColors.white }}>
                {networkFeeEth
                  ? `${networkFeeEth} ${asset.symbol} (live, from current gas price)`
                  : 'Tap REVIEW SEND to fetch the live network fee'}
              </Text>
            </View>

            {previewQuote && (
              <View style={styles.quoteBox}>
                <Text style={styles.quoteTitle}>FEE PREVIEW</Text>

                <View style={styles.quoteRow}>
                  <Text style={styles.quoteLabel}>Recipient receives</Text>
                  <Text style={styles.quoteValue}>{previewQuote.recipientReceivesUsd} {asset.symbol}</Text>
                </View>

                <View style={styles.quoteRow}>
                  <Text style={styles.quoteLabel}>Network fee</Text>
                  <Text style={styles.quoteValue}>{previewQuote.estimatedFeeUsd} {asset.symbol}</Text>
                </View>

                <View style={styles.quoteRow}>
                  <Text style={styles.quoteLabel}>Shogun fee</Text>
                  <Text style={styles.quoteValue}>{previewQuote.shogunFeeUsd} {asset.symbol}</Text>
                </View>

                <View style={styles.quoteRow}>
                  <Text style={styles.quoteLabel}>Ron1n fee</Text>
                  <Text style={styles.quoteValue}>{previewQuote.ron1nFeeUsd} {asset.symbol}</Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.quoteRow}>
                  <Text style={styles.quoteLabelStrong}>Total required</Text>
                  <Text style={styles.quoteValueStrong}>{previewQuote.totalRequiredUsd} {asset.symbol}</Text>
                </View>

                <Text style={styles.quoteWarning}>{previewQuote.warning}</Text>
              </View>
            )}

            <View style={styles.reviewButtonWrap}>
              <Ron1nButton
                label="REVIEW SEND"
                variant="primary"
                icon="shield-checkmark-outline"
                onPress={() => void openReview()}
                accessibilityHint="Opens the full transaction review before authorization"
              />
            </View>
          </Ron1nCard>

          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>NETWORK FEE NOTICE</Text>
            <Text style={styles.warningText}>
              {SecurityPolicyService.getFeeDisclosure()}
            </Text>
          </View>

          <View style={styles.bottomSpace} />
        </ScrollView>

        <KeyRotationModal
          visible={rotationModalOpen}
          symbol={asset.symbol}
          currentAddress={transactionIntent?.from || 'Address unavailable'}
          onClose={() => setRotationModalOpen(false)}
          onSelectFreshKey={(freshLabel) => {
            Alert.alert('Rotated Key Selected', `Using ${freshLabel} for asset preparation.`);
          }}
        />

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

              <ScrollView showsVerticalScrollIndicator={false}>
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
                      <Text style={styles.quoteValue}>{feeQuote.recipientReceivesUsd} {feeQuote.asset}</Text>
                    </View>

                    <View style={styles.quoteRow}>
                      <Text style={styles.quoteLabel}>Network fee</Text>
                      <Text style={styles.quoteValue}>{feeQuote.estimatedFeeUsd} {feeQuote.asset}</Text>
                    </View>

                    <View style={styles.quoteRow}>
                      <Text style={styles.quoteLabel}>Shogun fee</Text>
                      <Text style={styles.quoteValue}>{feeQuote.shogunFeeUsd} {feeQuote.asset}</Text>
                    </View>

                    <View style={styles.quoteRow}>
                      <Text style={styles.quoteLabel}>Ron1n fee</Text>
                      <Text style={styles.quoteValue}>{feeQuote.ron1nFeeUsd} {feeQuote.asset}</Text>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.quoteRow}>
                      <Text style={styles.quoteLabelStrong}>Total required</Text>
                      <Text style={styles.quoteValueStrong}>{feeQuote.totalRequiredUsd} {feeQuote.asset}</Text>
                    </View>

                    <Text style={styles.quoteWarning}>{feeQuote.warning}</Text>
                  </View>

                  <Text style={styles.reviewAddress} selectable>
                    From: {transactionIntent?.from || 'Pending'}
                  </Text>
                  <Text style={styles.reviewAddress} selectable>
                    To: {recipient}
                  </Text>
                </>
              )}

              {policyResult && (
                <View style={styles.policyBox}>
                  <View style={styles.policyHeader}>
                    <Text style={styles.policyTitle}>SECURITY POLICY</Text>
                    <Ron1nStatusBadge
                      tone={policyDecisionTone(policyResult.decision)}
                      label={policyResult.decision.replace(/_/g, ' ')}
                    />
                  </View>
                  <Text style={styles.providerText}>
                    Profile: {securityProfile} • Policy: {policyResult.policyVersion}
                  </Text>
                  <Text style={styles.providerText}>
                    {policyResult.reasonCodes.join(' • ')}
                  </Text>
                  {policyResult.requiresRotation && (
                    <Text style={styles.policyWarning}>Key rotation required before authorization.</Text>
                  )}
                  {policyResult.requiresMigration && (
                    <Text style={styles.policyWarning}>Asset migration required before authorization.</Text>
                  )}
                </View>
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
                accessibilityRole="checkbox"
                accessibilityState={{ checked: acknowledged }}
                accessibilityLabel="I understand this fee is required by the selected blockchain network and is not paid to Shogun Wallet."
              >
                <Text style={styles.checkText}>
                  {acknowledged ? '✓ ' : ''}
                  I understand this fee is required by the selected blockchain network
                  and is not paid to Shogun Wallet.
                </Text>
              </TouchableOpacity>
              </ScrollView>

              <Ron1nButton
                label="BIOMETRIC CONFIRM"
                variant="primary"
                icon="finger-print-outline"
                disabled={!acknowledged || policyResult?.decision === 'BLOCK'}
                onPress={() => void confirmSendReview()}
                accessibilityHint="Authorizes this transaction with biometrics and proceeds to signing"
              />

              <View style={styles.cancelButtonWrap}>
                <Ron1nButton
                  label="CANCEL"
                  variant="ghost"
                  onPress={() => setReviewOpen(false)}
                />
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </Ron1nScreen>
  );
}

const styles = StyleSheet.create({
  label: {
    color: Ron1nColors.gray,
    fontSize: 9,
    letterSpacing: 2,
    marginBottom: 10,
    marginTop: 14,
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
  },
  rotationWarningBox: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: Ron1nColors.gold,
    backgroundColor: '#1A1300',
    borderRadius: 14,
    padding: 12,
  },
  rotationWarningText: {
    color: Ron1nColors.gold,
    fontSize: 11,
    lineHeight: 17,
  },
  rotationTriggerButton: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: Ron1nColors.gold,
    backgroundColor: '#1A1300',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  rotationTriggerText: {
    color: Ron1nColors.gold,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
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
  amountHelp: {
    color: '#777777',
    fontSize: 10,
    lineHeight: 16,
    marginTop: 7,
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
  },
  reviewLine: {
    color: Ron1nColors.green,
    marginTop: 12,
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
  policyBox: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: Ron1nColors.gold,
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#1A1300',
  },
  cancelButtonWrap: {
    marginTop: 10,
  },
  reviewButtonWrap: {
    marginTop: 18,
  },
  policyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  policyTitle: {
    color: Ron1nColors.gold,
    fontSize: 10,
    fontWeight: '900',
  },
  policyWarning: {
    color: Ron1nColors.gold,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 8,
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
  },
  cancelButton: {
    padding: 15,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: Ron1nColors.gray,
  },
  bottomSpace: {
    height: 110,
  },
});



