import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ron1nColors } from '../theme/ron1nTheme';

type ManualSyncConsentModalProps = {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ManualSyncConsentModal({
  visible,
  onCancel,
  onConfirm,
}: ManualSyncConsentModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.kicker}>PRIVACY NOTICE</Text>
          <Text style={styles.title}>Manual Chain Sync</Text>

          <Text style={styles.body}>
            This action may query public blockchain providers using your wallet
            addresses. Public-chain balances and transactions may be visible on
            their native networks.
          </Text>

          <Text style={styles.body}>
            Ron1n Syndicate does not custody your assets, collect your recovery
            phrase, or receive network fees.
          </Text>

          <View style={styles.actions}>
            <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
              <Text style={styles.cancelText}>CANCEL</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onConfirm} style={styles.confirmButton}>
              <Text style={styles.confirmText}>I UNDERSTAND</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#000000CC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  card: {
    width: '100%',
    backgroundColor: '#070707',
    borderRadius: 26,
    padding: 24,
    borderWidth: 1,
    borderColor: '#00FF4166',
  },
  kicker: {
    color: Ron1nColors.green,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 3,
    marginBottom: 10,
  },
  title: {
    color: Ron1nColors.gold,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 14,
  },
  body: {
    color: '#CCCCCC',
    fontSize: 13,
    lineHeight: 21,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#00FF4122',
    borderWidth: 1,
    borderColor: '#00FF4188',
    alignItems: 'center',
  },
  cancelText: {
    color: '#AAAAAA',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  confirmText: {
    color: Ron1nColors.green,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
});