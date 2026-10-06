import React from 'react';
import { Modal, View, Text, ScrollView, StyleSheet, Share, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';

import Ron1nButton from './Ron1nButton';
import Ron1nStatusBadge from './Ron1nStatusBadge';
import { Ron1nColors, Ron1nRadii, Ron1nSpacing, Ron1nTypography } from '../theme/ron1nTheme';

export type AssetInfo = {
  symbol: string;
  name: string;
  address: string;
};

interface ReceiveModalProps {
  visible: boolean;
  onClose: () => void;
  asset: AssetInfo | null;
  onRotatePress?: () => void;
}

/**
 * Receive is deliberately simple first - asset, address, QR, copy - with
 * identity/rotation context progressively disclosed below rather than
 * leading with it. Content scrolls independently of the pinned action
 * row/close button so the sheet never gets stuck unscrollable on a small
 * device, regardless of how long the ETH rotation notice gets.
 */
export default function ReceiveModal({ visible, onClose, asset, onRotatePress }: ReceiveModalProps) {
  if (!asset) return null;

  const handleCopyAddress = async () => {
    await Clipboard.setStringAsync(asset.address);
    Alert.alert('Copied', `${asset.symbol} copied to clipboard.`);
  };

  const handleShareAddress = async () => {
    try {
      await Share.share({
        message: `Here's my ${asset.symbol} address on Shogun Wallet:\n\n${asset.address}`,
      });
    } catch (error) {
      console.error('Error sharing address:', error);
    }
  };

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView edges={['bottom']} style={styles.modalContainer}>
          <LinearGradient
            pointerEvents="none"
            colors={['#B026FF22', '#B026FF00']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.headerGlow}
          />

          <View style={styles.dragHandle} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.header}>
              <Text style={styles.headerText}>RECEIVE {asset.symbol}</Text>
              <Text style={styles.headerSubtitle}>
                Scan the code or share the address below to get paid in {asset.name}.
              </Text>
            </View>

            <View
              style={styles.qrContainer}
              accessible
              accessibilityRole="image"
              accessibilityLabel={`QR code for ${asset.symbol} receive address`}
            >
              <QRCode value={asset.address} size={200} color="#000000" backgroundColor="#FFFFFF" />
            </View>

            <Ron1nStatusBadge tone="danger" label={`${asset.symbol} NETWORK ONLY`} />

            <View style={styles.addressContainer}>
              <Text style={styles.networkWarning}>
                Only send {asset.name} ({asset.symbol}) here — funds sent on the wrong network
                can't be recovered.
              </Text>

              <Text style={styles.addressText} selectable accessibilityLabel={`Address: ${asset.address}`}>
                {asset.address}
              </Text>
            </View>

            <View style={styles.identitySection}>
              <Text style={styles.identityLabel}>RECEIVE IDENTITY</Text>
              <Text style={styles.identityValue}>Public on {asset.name}'s blockchain.</Text>
            </View>

            {asset.symbol.toUpperCase() === 'ETH' && (
              <View style={styles.rotationNotice}>
                <Text style={styles.rotationNoticeText}>
                  Once this address receives funds, you'll need to rotate it to a new address
                  before you can send from it (Send → Inspect & Rotate Keys). Why: spending from
                  an address reveals its public key on-chain — receiving never does. Rotating
                  keeps your incoming and outgoing history unlinkable and limits exposure if a
                  future quantum computer ever threatens exposed public keys.{'\n\n'}
                  Note: rotating costs a real network fee each time, the same as sending a
                  transaction — it is not free and not a one-time cost.
                </Text>

                {onRotatePress ? (
                  <View style={styles.rotateNoticeButton}>
                    <Ron1nButton
                      label="ROTATE ADDRESS NOW"
                      variant="outline"
                      fullWidth
                      onPress={() => {
                        onClose();
                        onRotatePress();
                      }}
                      accessibilityHint="Opens key rotation for this ETH address"
                    />
                  </View>
                ) : null}
              </View>
            )}
          </ScrollView>

          <View style={styles.actionRow}>
            <View style={styles.actionButtonWrap}>
              <Ron1nButton
                label="COPY"
                variant="primary"
                icon="copy-outline"
                onPress={() => void handleCopyAddress()}
                accessibilityHint="Copies the receive address to your clipboard"
              />
            </View>

            <View style={styles.actionButtonWrap}>
              <Ron1nButton
                label="SHARE"
                variant="secondary"
                icon="share-outline"
                onPress={() => void handleShareAddress()}
                accessibilityHint="Opens the share sheet for this address"
              />
            </View>
          </View>

          <Ron1nButton label="CLOSE" variant="ghost" onPress={onClose} />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    maxHeight: '88%',
    backgroundColor: '#0A0A0A',
    borderTopLeftRadius: Ron1nRadii.lg,
    borderTopRightRadius: Ron1nRadii.lg,
    paddingHorizontal: Ron1nSpacing.xl,
    paddingTop: Ron1nSpacing.sm,
    paddingBottom: Ron1nSpacing.lg,
    borderWidth: 1,
    borderColor: '#B026FF',
    overflow: 'hidden',
  },
  headerGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 140,
  },
  dragHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: Ron1nSpacing.md,
  },
  scrollContent: {
    alignItems: 'center',
    paddingBottom: Ron1nSpacing.lg,
  },
  header: { marginBottom: Ron1nSpacing.lg, alignItems: 'center' },
  headerText: {
    ...Ron1nTypography.screenTitle,
    color: Ron1nColors.white,
  },
  headerSubtitle: {
    ...Ron1nTypography.bodySecondary,
    color: '#9B9BA8',
    textAlign: 'center',
    marginTop: Ron1nSpacing.xs,
    maxWidth: 260,
  },
  qrContainer: {
    padding: Ron1nSpacing.lg,
    backgroundColor: '#FFFFFF',
    borderRadius: Ron1nRadii.md,
    borderWidth: 2,
    borderColor: '#00FF41',
    marginBottom: Ron1nSpacing.md,
  },
  addressContainer: {
    width: '100%',
    backgroundColor: '#1A1A1A',
    padding: Ron1nSpacing.lg,
    borderRadius: Ron1nRadii.sm,
    marginTop: Ron1nSpacing.md,
    marginBottom: Ron1nSpacing.lg,
  },
  networkWarning: {
    ...Ron1nTypography.caption,
    color: '#FF3366',
    textAlign: 'center',
    marginBottom: Ron1nSpacing.sm,
  },
  addressText: {
    color: '#00FF41',
    fontSize: 13,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  identitySection: {
    width: '100%',
    marginBottom: Ron1nSpacing.lg,
  },
  identityLabel: {
    ...Ron1nTypography.label,
    color: Ron1nColors.gray,
    marginBottom: Ron1nSpacing.xs,
  },
  identityValue: {
    ...Ron1nTypography.bodySecondary,
    color: Ron1nColors.white,
  },
  rotationNotice: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#FFD700',
    backgroundColor: '#1A1300',
    borderRadius: Ron1nRadii.sm,
    padding: Ron1nSpacing.md,
  },
  rotationNoticeText: {
    color: '#FFD700',
    fontSize: 10,
    lineHeight: 16,
  },
  rotateNoticeButton: {
    marginTop: Ron1nSpacing.sm + 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Ron1nSpacing.sm,
    width: '100%',
    marginTop: Ron1nSpacing.sm,
    marginBottom: Ron1nSpacing.sm,
  },
  actionButtonWrap: {
    flex: 1,
  },
});
