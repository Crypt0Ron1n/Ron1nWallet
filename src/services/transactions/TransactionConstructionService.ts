import { ethers } from 'ethers';
import { ChainAdapterFactory } from '../chains/ChainAdapterFactory';
import type { UnsignedTransactionDraft, TransactionConstructionResult } from '../chains/types';
import { NetworkStateService } from '../network/NetworkStateService';
import { validateTransactionIntent, type TransactionIntent } from './TransactionIntent';

function stableStringify(value:unknown):string{if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return `[${value.map(stableStringify).join(',')}]`;const r=value as Record<string,unknown>;return `{${Object.keys(r).sort().map(k=>`${JSON.stringify(k)}:${stableStringify(r[k])}`).join(',')}}`;}

export class TransactionConstructionService{
 static async prepare(intent:TransactionIntent):Promise<TransactionConstructionResult>{
  const validation=validateTransactionIntent(intent); if(!validation.valid)throw new Error(`Transaction construction blocked: invalid transaction intent (${validation.codes.join(', ')})`);
  const networkState=await NetworkStateService.resolve({chain:intent.asset.chain,network:intent.asset.network,from:intent.from,to:intent.to}); if(networkState.status==='UNAVAILABLE')throw new Error(`Transaction construction blocked: network state unavailable (${networkState.warnings.join('; ')})`);
  const adapter=ChainAdapterFactory.get(intent.asset.chain); if(!adapter.validateRecipient(intent.to))throw new Error('Transaction construction blocked: invalid recipient.');
  const draft:UnsignedTransactionDraft=await adapter.buildDraft({intent,networkState}); if(draft.signable)throw new Error('Security violation: construction artifact cannot be signable.');
  const transactionDigest=ethers.sha256(ethers.toUtf8Bytes(stableStringify({intent,draft,networkState})));
  const warnings=['Unsigned transaction construction completed.','Private keys and recovery material were not accessed.','Broadcast is not permitted from this construction layer.',...networkState.warnings];
  if(networkState.status!=='READY')warnings.push('Network state is partial; signing must remain blocked until required state is resolved.');
  if(draft.kind==='UTXO_TRANSFER')warnings.push('UTXO fee/change planning must be revalidated against the final script type and actual transaction weight before signing.');
  if(intent.amountUnit==='TOKEN'&&!intent.asset.tokenContract)warnings.push('Token contract metadata is unresolved; token signing cannot proceed.');
  return {draft,networkState,transactionDigest,warnings};
 }
}
