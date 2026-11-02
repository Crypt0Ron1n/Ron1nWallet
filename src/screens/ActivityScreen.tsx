import React, { useCallback, useState } from 'react';
import {
  Alert,
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
import Ron1nScreenHeader from '../components/Ron1nScreenHeader';
import Ron1nStatusBadge from '../components/Ron1nStatusBadge';
import Ron1nEmptyState from '../components/Ron1nEmptyState';
import Ron1nButton from '../components/Ron1nButton';
import { ActivityService, type Ron1nActivity } from '../services/transactions/ActivityService';
import {
  ChainActivityCacheService,
  type CachedChainActivity,
} from '../services/transactions/ChainActivityCacheService';
import {
  TransactionLifecycleService,
  type PersistedTransactionLifecycle,
  type TransactionLifecycleState,
} from '../services/transactions/TransactionLifecycleService';
import { BroadcastService } from '../services/transactions/BroadcastService';
import { Ron1nColors, Ron1nGlass, Ron1nMonospace, Ron1nSpacing, Ron1nTypography, type Ron1nStatusTone } from '../theme/ron1nTheme';

type ActivityTab = 'PRIVATE' | 'CHAIN' | 'TRANSACTIONS';

/**
 * Only these states have anything meaningful to resolve. CONFIRMED/FAILED
 * are already terminal (nothing to check); CREATED/SIGNED were never even
 * submitted to a provider, so reconciling them would only ever and always
 * report UNKNOWN - offering an action there would look like progress
 * without ever being able to produce one.
 */
const RECONCILABLE_STATES: ReadonlySet<TransactionLifecycleState> = new Set([
  'BROADCASTING',
  'PENDING',
  'UNKNOWN',
  'RECONCILE_REQUIRED',
]);

const LIFECYCLE_TONE: Record<TransactionLifecycleState, Ron1nStatusTone> = {
  CREATED: 'neutral',
  SIGNED: 'neutral',
  BROADCASTING: 'info',
  BROADCAST_ACCEPTED: 'info',
  PENDING: 'info',
  CONFIRMED: 'success',
  FAILED: 'danger',
  // UNKNOWN is deliberately NOT danger/FAILED - the provider simply could not
  // locate the transaction yet. Warning communicates "unresolved", not "dead".
  UNKNOWN: 'warning',
  RECONCILE_REQUIRED: 'warning',
};

export default function ActivityScreen() {
  const [activeTab, setActiveTab] = useState<ActivityTab>('PRIVATE');
  const [activities, setActivities] = useState<Ron1nActivity[]>([]);
  const [chainActivity, setChainActivity] = useState<Record<string, CachedChainActivity>>({});
  const [lifecycleRecords, setLifecycleRecords] = useState<PersistedTransactionLifecycle[]>([]);
  const [reconcilingHashes, setReconcilingHashes] = useState<ReadonlySet<string>>(new Set());

  const load = async () => {
    try {
      const [localData, chainData, lifecycleData] = await Promise.all([
        ActivityService.getActivities(),
        ChainActivityCacheService.getCache(),
        TransactionLifecycleService.listAll(),
      ]);

      setActivities(localData);
      setChainActivity(chainData);
      setLifecycleRecords(
        [...lifecycleData].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )
      );
    } catch (error) {
      console.error('Failed to load activity:', error);
      setActivities([]);
      setChainActivity({});
      setLifecycleRecords([]);
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

  const clearChainCache = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();

    if (hasHardware) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to Clear Chain Cache',
        fallbackLabel: 'Use device passcode',
      });

      if (!result.success) {
        Alert.alert('Blocked', 'Authentication failed.');
        return;
      }
    }

    Alert.alert(
      'Clear Chain Cache',
      'This clears cached public-chain history from this device. It does not affect your wallet or any blockchain records.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await ChainActivityCacheService.clearCache();
              setChainActivity({});

              await ActivityService.addActivity(
                'SECURITY',
                'Chain Activity Cache Cleared',
                'User cleared cached public-chain activity from this device'
              );

              await load();
              Alert.alert('Cleared', 'Cached chain activity has been cleared.');
            } catch (error) {
              Alert.alert('Error', 'Unable to clear chain cache.');
            }
          },
        },
      ]
    );
  };

  const handleReconcile = async (transactionHash: string) => {
    if (reconcilingHashes.has(transactionHash)) {
      return;
    }

    setReconcilingHashes((prev) => new Set(prev).add(transactionHash));

    try {
      const result = await BroadcastService.recoverPersisted(transactionHash);

      if (!result.ok) {
        const title =
          result.code === 'PROVIDER_ERROR'
            ? 'Reconciliation Unavailable'
            : result.code === 'IN_PROGRESS'
              ? 'Already Reconciling'
              : result.code === 'UNSUPPORTED'
                ? 'Not Supported'
                : 'Reconciliation Failed';

        const message =
          result.code === 'PROVIDER_ERROR'
            ? `The network provider could not be reached. This does not mean the transaction failed.\n\n${result.reason}`
            : result.reason;

        Alert.alert(title, message);
        return;
      }

      const { reconciliation, alreadyTerminal } = result;

      if (alreadyTerminal) {
        Alert.alert(
          'Already Resolved',
          `This transaction already reached a final state (${reconciliation.status}). Nothing to reconcile.`
        );
      } else if (reconciliation.status === 'CONFIRMED') {
        Alert.alert(
          'Transaction Confirmed',
          `Confirmed in block ${reconciliation.blockNumber ?? 'unknown'} with ${reconciliation.confirmations ?? 0} confirmation(s).`
        );
      } else if (reconciliation.status === 'FAILED') {
        Alert.alert(
          'Transaction Failed On-Chain',
          'The network reported a failed execution status for this transaction.'
        );
      } else if (reconciliation.status === 'PENDING') {
        Alert.alert('Still Pending', 'The provider has seen this transaction but it has not been mined yet.');
      } else {
        Alert.alert(
          'Still Unknown',
          'The provider could not locate this transaction yet. This is not proof it failed - try again shortly.'
        );
      }
    } catch (error) {
      Alert.alert(
        'Reconciliation Error',
        error instanceof Error ? error.message : 'Unable to reconcile this transaction right now.'
      );
    } finally {
      setReconcilingHashes((prev) => {
        const next = new Set(prev);
        next.delete(transactionHash);
        return next;
      });
      await load();
    }
  };

  const renderTabs = () => (
    <View style={styles.tabRow}>
      <TouchableOpacity
        onPress={() => setActiveTab('PRIVATE')}
        style={[styles.tabButton, activeTab === 'PRIVATE' && styles.activeTabButton]}
      >
        <Text style={[styles.tabText, activeTab === 'PRIVATE' && styles.activeTabText]}>
          PRIVATE
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setActiveTab('CHAIN')}
        style={[styles.tabButton, activeTab === 'CHAIN' && styles.activeTabButton]}
      >
        <Text style={[styles.tabText, activeTab === 'CHAIN' && styles.activeTabText]}>
          CHAIN
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setActiveTab('TRANSACTIONS')}
        style={[styles.tabButton, activeTab === 'TRANSACTIONS' && styles.activeTabButton]}
      >
        <Text style={[styles.tabText, activeTab === 'TRANSACTIONS' && styles.activeTabText]}>
          SIGNED
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderTransactions = () => (
    <>
      <Ron1nCard>
        <Text style={styles.sectionTitle}>SIGNED TRANSACTION LIFECYCLE</Text>
        <Text style={styles.body}>
          Every transaction Shogun has signed, from broadcast through reconciliation.
          UNKNOWN means the network provider could not locate the transaction yet — it
          is not the same as FAILED, and Shogun never treats it as failed.
        </Text>
      </Ron1nCard>

      {lifecycleRecords.length === 0 ? (
        <Ron1nCard>
          <Ron1nEmptyState
            icon="swap-vertical-outline"
            title="NO SIGNED TRANSACTIONS YET"
            message="Transactions will appear here once you send something from Shogun Wallet."
          />
        </Ron1nCard>
      ) : (
        <View style={styles.list}>
          {lifecycleRecords.map((record) => (
            <Ron1nCard key={record.transactionHash}>
              <View style={styles.lifecycleHeader}>
                <View>
                  <Text style={styles.chainSymbol}>{record.asset}</Text>
                  <Text style={styles.timestamp}>
                    {new Date(record.updatedAt).toLocaleString()}
                  </Text>
                </View>

                <Ron1nStatusBadge tone={LIFECYCLE_TONE[record.state]} label={record.state.replace(/_/g, ' ')} />
              </View>

              <View style={styles.lifecycleMetaRow}>
                <Text style={styles.txMeta}>Amount: {record.amount} {record.asset}</Text>
                {record.network ? <Text style={styles.txMeta}>Network: {record.network}</Text> : null}
                {typeof record.nonce === 'number' ? (
                  <Text style={styles.txMeta}>Nonce: {record.nonce}</Text>
                ) : null}
              </View>

              <Text style={styles.txMeta} selectable>
                To: {record.to}
              </Text>

              <Text style={styles.txHash} selectable>
                {record.transactionHash}
              </Text>

              {record.lastError ? (
                <Text style={styles.errorText}>{record.lastError}</Text>
              ) : null}

              {RECONCILABLE_STATES.has(record.state) ? (
                BroadcastService.isReconciliationSupported(record.asset) ? (
                  <View style={styles.reconcileButtonWrap}>
                    <Ron1nButton
                      label={reconcilingHashes.has(record.transactionHash) ? 'RECONCILING…' : 'RECONCILE'}
                      variant="outline"
                      fullWidth={false}
                      busy={reconcilingHashes.has(record.transactionHash)}
                      disabled={reconcilingHashes.has(record.transactionHash)}
                      onPress={() => void handleReconcile(record.transactionHash)}
                      accessibilityHint="Checks the live network for this transaction's current status. Never signs or resubmits anything."
                    />
                  </View>
                ) : (
                  <Text style={styles.reconcileUnsupportedText}>
                    Reconciliation is not available yet for {record.asset}.
                  </Text>
                )
              ) : null}
            </Ron1nCard>
          ))}
        </View>
      )}
    </>
  );

  const renderPrivateActivity = () => (
    <>
      <Ron1nCard>
        <Text style={styles.sectionTitle}>PRIVATE DEVICE LEDGER</Text>
        <Text style={styles.body}>
          Private Activity is stored locally on this device. It tracks wallet actions,
          receive views, security events, restore events, and manual sync events.
        </Text>
      </Ron1nCard>

      <TouchableOpacity onPress={clearActivity} style={styles.clearButton}>
        <Text style={styles.clearText}>CLEAR LOCAL ACTIVITY</Text>
      </TouchableOpacity>

      {activities.length === 0 ? (
        <Ron1nCard>
          <Ron1nEmptyState
            icon="document-text-outline"
            title="NO LOCAL ACTIVITY"
            message="Wallet actions, receive views, security scans, and manual sync events will appear here."
          />
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
    </>
  );

  const renderChainActivity = () => {
    const records = Object.values(chainActivity).sort((a, b) => {
      const aTime = new Date(a.syncedAt || 0).getTime();
      const bTime = new Date(b.syncedAt || 0).getTime();
      return bTime - aTime;
    });

    return (
      <>
        <Ron1nCard>
          <Text style={styles.sectionTitle}>PUBLIC CHAIN ACTIVITY</Text>
          <Text style={styles.body}>
            Chain Activity is cached from user-approved manual syncs. It is read-only
            public blockchain history and does not mean Ron1n controls, stores, or
            custodies your assets.
          </Text>
        </Ron1nCard>

        <TouchableOpacity onPress={clearChainCache} style={styles.clearButton}>
          <Text style={styles.clearText}>CLEAR CHAIN CACHE</Text>
        </TouchableOpacity>

        {records.length === 0 ? (
          <Ron1nCard>
            <Ron1nEmptyState
              icon="cloud-offline-outline"
              title="NO CHAIN ACTIVITY CACHED"
              message="Go to Wallet, enable Manual Sync, approve the privacy notice, and sync public-chain balances/activity."
            />
          </Ron1nCard>
        ) : (
          <View style={styles.list}>
            {records.map((record) => {
              const failed = record.status === 'FAILED';
              const transactions = record.transactions || [];

              return (
                <Ron1nCard key={record.symbol}>
                  <View style={styles.chainHeader}>
                    <View>
                      <Text style={styles.chainSymbol}>{record.symbol}</Text>
                      <Text style={styles.timestamp}>
                        Synced: {new Date(record.syncedAt).toLocaleString()}
                      </Text>
                    </View>

                    <Ron1nStatusBadge tone={failed ? 'danger' : 'success'} label={record.status} />
                  </View>

                  {failed ? (
                    <Text style={styles.errorText}>
                      {record.error || 'Provider failed during last sync.'}
                    </Text>
                  ) : transactions.length === 0 ? (
                    <Text style={styles.body}>
                      No transactions returned by provider during the last sync.
                    </Text>
                  ) : (
                    <View style={styles.txList}>
                      <Text style={styles.txCount}>
                        {transactions.length} transaction{transactions.length === 1 ? '' : 's'} cached
                      </Text>

                      {transactions.slice(0, 5).map((tx, index) => {
                        const anyTx = tx as any;
                        const hash =
                          anyTx.hash ||
                          anyTx.txHash ||
                          anyTx.signature ||
                          anyTx.id ||
                          `transaction-${index + 1}`;

                        const direction = anyTx.direction || anyTx.type || 'ACTIVITY';
                        const amount = anyTx.amount || anyTx.value || '';
                        const date = anyTx.date || anyTx.timestamp || anyTx.createdAt;
                        const counterparty = direction === 'OUT' ? anyTx.to : anyTx.from;

                        return (
                          <View key={`${record.symbol}-${hash}-${index}`} style={styles.txRow}>
                            <Text style={styles.txTitle}>{direction}</Text>
                            {amount ? <Text style={styles.txMeta}>Amount: {String(amount)}</Text> : null}
                            {counterparty ? (
                              <Text style={styles.txMeta} selectable>
                                {direction === 'OUT' ? 'To: ' : 'From: '}
                                {String(counterparty)}
                              </Text>
                            ) : null}
                            <Text style={styles.txHash} selectable>
                              {String(hash)}
                            </Text>
                            {date ? (
                              <Text style={styles.timestamp}>
                                {new Date(date).toLocaleString()}
                              </Text>
                            ) : null}
                          </View>
                        );
                      })}

                      {transactions.length > 5 ? (
                        <Text style={styles.moreIssues}>
                          +{transactions.length - 5} more cached transactions
                        </Text>
                      ) : null}
                    </View>
                  )}
                </Ron1nCard>
              );
            })}
          </View>
        )}
      </>
    );
  };

  return (
    <Ron1nScreen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Ron1nScreenHeader
          title="ACTIVITY"
          subtitle="PRIVATE + CHAIN LEDGER"
          accent="gold"
        />

        {renderTabs()}

        {activeTab === 'PRIVATE'
          ? renderPrivateActivity()
          : activeTab === 'CHAIN'
            ? renderChainActivity()
            : renderTransactions()}
      </ScrollView>
    </Ron1nScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 120,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  tabButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Ron1nGlass.border,
    backgroundColor: Ron1nColors.surface,
  },
  activeTabButton: {
    borderColor: `${Ron1nColors.green}66`,
    backgroundColor: `${Ron1nColors.green}15`,
  },
  tabText: {
    color: Ron1nColors.muted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
  activeTabText: {
    color: Ron1nColors.green,
  },
  sectionTitle: {
    color: Ron1nColors.green,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 10,
  },
  body: {
    color: Ron1nColors.gray,
    fontSize: 12,
    lineHeight: 19,
  },
  clearButton: {
    marginBottom: 14,
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${Ron1nColors.danger}66`,
    backgroundColor: `${Ron1nColors.danger}12`,
    alignItems: 'center',
  },
  clearText: {
    color: Ron1nColors.danger,
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
    color: Ron1nColors.muted,
    fontSize: 10,
    marginTop: 6,
  },
  lifecycleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Ron1nSpacing.sm,
  },
  lifecycleMetaRow: {
    marginBottom: Ron1nSpacing.xs,
  },
  chainHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  chainSymbol: {
    color: Ron1nColors.gold,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
  },
  statusBadge: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  okBadge: {
    borderColor: `${Ron1nColors.green}66`,
    backgroundColor: `${Ron1nColors.green}12`,
  },
  failedBadge: {
    borderColor: `${Ron1nColors.danger}66`,
    backgroundColor: `${Ron1nColors.danger}12`,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  okText: {
    color: Ron1nColors.green,
  },
  failedText: {
    color: Ron1nColors.danger,
  },
  errorText: {
    color: Ron1nColors.danger,
    fontSize: 12,
    lineHeight: 18,
  },
  reconcileButtonWrap: {
    marginTop: Ron1nSpacing.sm,
    alignSelf: 'flex-start',
  },
  reconcileUnsupportedText: {
    ...Ron1nTypography.caption,
    color: Ron1nColors.muted,
    marginTop: Ron1nSpacing.sm,
  },
  txList: {
    gap: 10,
  },
  txCount: {
    color: Ron1nColors.green,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
  },
  txRow: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${Ron1nColors.gold}33`,
    backgroundColor: Ron1nColors.black,
    padding: 10,
  },
  txTitle: {
    color: Ron1nColors.white,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 4,
  },
  txMeta: {
    color: Ron1nColors.gray,
    fontSize: 11,
    marginBottom: 4,
  },
  txHash: {
    color: Ron1nColors.muted,
    fontSize: 10,
    fontFamily: Ron1nMonospace.fontFamily,
  },
  moreIssues: {
    color: Ron1nColors.gray,
    fontSize: 11,
    marginTop: 4,
  },
});