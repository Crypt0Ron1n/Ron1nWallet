import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Alert,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';

export type AssetInfo = {
  symbol: string;
  name: string;
  address: string;
};

interface ReceiveModalProps {
  visible: boolean;
  onClose: () => void;
  asset: AssetInfo | null;
}

export default function ReceiveModal({ visible, onClose, asset }: ReceiveModalProps) {
  if (!asset) return null;

  const handleCopyAddress = async () => {
    await Clipboard.setStringAsync(asset.address);
    Alert.alert('Copied', `${asset.symbol} copied to clipboard.`);
  };

  const handleShareAddress = async () => {
    try {
      await Share.share({
        message: `Here is my Ron1n ${asset.symbol}:\n\n${asset.address}`,
      });
    } catch (error) {
      console.error('Error sharing address:', error);
    }
  };

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.headerText}>RECEIVE {asset.symbol}</Text>
          </View>

          <View style={styles.qrContainer}>
            <QRCode
              value={asset.address}
              size={200}
              color="#000000"
              backgroundColor="#FFFFFF"
            />
          </View>

          <View style={styles.addressContainer}>
            <Text style={styles.networkWarning}>
              Send only {asset.name} ({asset.symbol}) to this address.
            </Text>

            <Text style={styles.addressText} selectable>
              {asset.address}
            </Text>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionButton} onPress={handleCopyAddress}>
              <Text style={styles.actionButtonText}>COPY</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButtonSecondary} onPress={handleShareAddress}>
              <Text style={styles.actionButtonTextSecondary}>SHARE</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>CLOSE</Text>
          </TouchableOpacity>
        </View>
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
    backgroundColor: '#0A0A0A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#B026FF',
    alignItems: 'center',
    shadowColor: '#B026FF',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  header: { marginBottom: 24 },
  headerText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1,
    fontFamily: 'KatakanaStyle',
  },
  qrContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#00FF41',
    marginBottom: 24,
  },
  addressContainer: {
    width: '100%',
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  networkWarning: {
    color: '#FF3366',
    fontSize: 10,
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '600',
    fontFamily: 'KatakanaStyle',
  },
  addressText: {
    color: '#00FF41',
    fontSize: 13,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#B026FF',
    paddingVertical: 14,
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
    fontFamily: 'KatakanaStyle',
  },
  actionButtonSecondary: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#00FF41',
    paddingVertical: 14,
    borderRadius: 8,
    marginLeft: 8,
    alignItems: 'center',
  },
  actionButtonTextSecondary: {
    color: '#00FF41',
    fontWeight: '900',
    fontSize: 12,
    fontFamily: 'KatakanaStyle',
  },
  closeButton: {
    width: '100%',
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#888888',
    fontSize: 12,
    fontFamily: 'KatakanaStyle',
  },
});