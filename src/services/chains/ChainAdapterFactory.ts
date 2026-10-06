import { Buffer } from 'buffer';
import { ethers } from 'ethers';
import bs58 from 'bs58';
import * as bitcoin from 'bitcoinjs-lib';
import * as SolanaWeb3 from '@solana/web3.js';
import type { SupportedChain } from '../crypto/types';
import type { TransactionIntent } from '../transactions/TransactionIntent';
import type { NetworkState } from '../network/types';
import { AssetAmountService } from '../assets/AssetAmountService';
import { litecoinNetwork } from '../crypto/litecoinNetwork';
import type { ChainAdapter, ChainAdapterContext, UnsignedTransactionDraft } from './types';

function utxoNetwork(chain: 'BITCOIN' | 'LITECOIN') {
  return chain === 'BITCOIN' ? bitcoin.networks.bitcoin : litecoinNetwork;
}

function validateUtxoAddress(address: string, chain: 'BITCOIN' | 'LITECOIN'): boolean {
  try {
    bitcoin.address.toOutputScript(address, utxoNetwork(chain));
    return true;
  } catch {
    return false;
  }
}

function validateBase5832(v:string){try{return bs58.decode(v).length===32;}catch{return false;}}
function validateXrp(v:string){return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(v);}
function validateStellar(v:string){return /^G[A-Z2-7]{55}$/.test(v);}
function validateAlgo(v:string){return /^[A-Z2-7]{58}$/.test(v);}
function requireField<T>(v:T|undefined,name:string,chain:string):T{if(v===undefined||v===null||v==='')throw new Error(`${chain} construction blocked: ${name} unresolved.`);return v;}
function createDraft(intent:TransactionIntent,kind:UnsignedTransactionDraft['kind'],payload:Readonly<Record<string,unknown>>):UnsignedTransactionDraft{
 const base=intent.asset.decimals===undefined?undefined:AssetAmountService.decimalToBaseUnits(intent.amount,intent.asset.decimals).toString();
 return {draftVersion:'1.1.0',kind,chain:intent.asset.chain,asset:intent.asset.symbol,accountId:intent.accountId,intentId:intent.intentId,from:intent.from,to:intent.to,amount:intent.amount,amountUnit:intent.amountUnit,...(base!==undefined?{amountBaseUnits:base}:{}),network:intent.asset.network,...(intent.asset.chainId!==undefined?{chainId:intent.asset.chainId}:{}),...(intent.memo!==undefined?{memo:intent.memo}:{}),payload,signable:false};
}
function requireAvailable(s:NetworkState,chain:string){if(s.status==='UNAVAILABLE')throw new Error(`${chain} network state unavailable.`);}

const evm:ChainAdapter={chain:'EVM',validateRecipient:v=>ethers.isAddress(v),async buildDraft({intent,networkState}:ChainAdapterContext){
 requireAvailable(networkState,'EVM'); if(!this.validateRecipient(intent.to))throw new Error('Invalid EVM recipient address.');
 if(intent.amountUnit==='TOKEN'){
  if(!intent.asset.tokenContract||intent.asset.decimals===undefined)throw new Error('EVM token construction blocked: token contract and decimals are unresolved.');
  const amount=AssetAmountService.decimalToBaseUnits(intent.amount,intent.asset.decimals);
  const encoded=ethers.AbiCoder.defaultAbiCoder().encode(['address','uint256'],[intent.to,amount]);
  return createDraft(intent,'EVM_ERC20_TRANSFER',{type:'legacy',chainId:requireField(networkState.chainId,'chainId','EVM'),nonce:requireField(networkState.nonce,'nonce','EVM'),to:intent.asset.tokenContract,value:'0',gasLimit:'TOKEN_GAS_LIMIT_REQUIRED',gasPrice:requireField(networkState.gasPriceBaseUnits,'gasPriceBaseUnits','EVM'),data:`${ethers.id('transfer(address,uint256)').slice(0,10)}${encoded.slice(2)}`,tokenContract:intent.asset.tokenContract,tokenAmountBaseUnits:amount.toString(),recipient:intent.to});
 }
 const amount=AssetAmountService.decimalToBaseUnits(intent.amount,intent.asset.decimals??18);
 return createDraft(intent,'EVM_TRANSFER',{type:'legacy',chainId:requireField(networkState.chainId,'chainId','EVM'),nonce:requireField(networkState.nonce,'nonce','EVM'),to:intent.to,value:amount.toString(),gasLimit:'21000',gasPrice:requireField(networkState.gasPriceBaseUnits,'gasPriceBaseUnits','EVM'),data:'0x'});
}};

function utxoAdapter(chain:'BITCOIN'|'LITECOIN'):ChainAdapter{return {chain,validateRecipient:v=>validateUtxoAddress(v,chain),async buildDraft({intent,networkState}){
 requireAvailable(networkState,chain); if(!this.validateRecipient(intent.to))throw new Error(`Invalid ${chain} recipient address.`); if(intent.amountUnit!=='NATIVE')throw new Error('UTXO token construction is unsupported.');
 const target=AssetAmountService.decimalToBaseUnits(intent.amount,intent.asset.decimals??8); const rate=BigInt(requireField(networkState.feePerByteBaseUnits,'feePerByteBaseUnits',chain)); const source=requireField(networkState.utxos,'utxos',chain); const ordered=[...source].filter(x=>x.statusConfirmed).sort((a,b)=>BigInt(a.valueBaseUnits)<BigInt(b.valueBaseUnits)?-1:1); const selected=[]; let total=0n; let fee=0n;
 for(const u of ordered){selected.push({txid:u.txid,vout:u.vout,valueBaseUnits:u.valueBaseUnits});total+=BigInt(u.valueBaseUnits);fee=BigInt(10+selected.length*68+2*31)*rate;if(total>=target+fee)break;}
 if(total<target+fee)throw new Error(`Insufficient confirmed ${chain} UTXOs for amount plus estimated fee.`); const change=total-target-fee;
 // All inputs are spending from this wallet's own address, so every input
 // shares the exact same locking script - compute it once from the known
 // source address rather than needing a per-UTXO lookup.
 const sourceScriptPubKeyHex=Buffer.from(bitcoin.address.toOutputScript(intent.from,utxoNetwork(chain))).toString('hex');
 return createDraft(intent,'UTXO_TRANSFER',{inputs:selected,outputs:[{address:intent.to,valueBaseUnits:target.toString()},...(change>0n?[{address:intent.from,valueBaseUnits:change.toString(),purpose:'CHANGE'}]:[])],feeRateBaseUnitsPerVbyte:rate.toString(),feeBaseUnits:fee.toString(),changeAddress:intent.from,selectionPolicy:'CONFIRMED_ASCENDING_VALUE',sourceScriptPubKeyHex});
}};}

const solana:ChainAdapter={chain:'SOLANA',validateRecipient:validateBase5832,async buildDraft({intent,networkState}){
 if(!this.validateRecipient(intent.to))throw new Error('Invalid Solana recipient address.'); const from=new SolanaWeb3.PublicKey(intent.from),to=new SolanaWeb3.PublicKey(intent.to); const lamports=AssetAmountService.decimalToBaseUnits(intent.amount,intent.asset.decimals??9); if(lamports>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('Solana amount exceeds safe integer range for transaction construction.');
 const tx=new SolanaWeb3.Transaction({recentBlockhash:requireField(networkState.latestBlockhash,'latestBlockhash','SOLANA'),feePayer:from}); tx.add(SolanaWeb3.SystemProgram.transfer({fromPubkey:from,toPubkey:to,lamports:Number(lamports)})); const msg=tx.serializeMessage();
 return createDraft(intent,'SOLANA_TRANSFER',{recentBlockhash:networkState.latestBlockhash,lastValidBlockHeight:networkState.lastValidBlockHeight,feeLamports:networkState.feeLamports??'UNRESOLVED',instruction:{program:'system',type:'transfer',from:from.toBase58(),to:to.toBase58(),lamports:lamports.toString()},compiledMessageBase64:Buffer.from(msg).toString('base64')});
}};

const xrp:ChainAdapter={chain:'XRP',validateRecipient:validateXrp,async buildDraft({intent,networkState}){
 requireAvailable(networkState,'XRP');if(!this.validateRecipient(intent.to))throw new Error('Invalid XRP recipient address.'); const amount=AssetAmountService.decimalToBaseUnits(intent.amount,intent.asset.decimals??6); return createDraft(intent,'XRP_PAYMENT',{TransactionType:'Payment',Account:intent.from,Destination:intent.to,Amount:amount.toString(),Fee:requireField(networkState.baseFeeBaseUnits,'baseFeeBaseUnits','XRP'),Sequence:requireField(networkState.sequence,'sequence','XRP'),LastLedgerSequence:requireField(networkState.ledgerIndex,'ledgerIndex','XRP')+4,...(intent.memo?{Memos:[{Memo:{MemoData:Buffer.from(intent.memo,'utf8').toString('hex')}}]}:{})});
}};

const stellar:ChainAdapter={chain:'STELLAR',validateRecipient:validateStellar,async buildDraft({intent,networkState}){
 requireAvailable(networkState,'STELLAR');if(!this.validateRecipient(intent.to))throw new Error('Invalid Stellar recipient address.'); const amount=AssetAmountService.decimalToBaseUnits(intent.amount,intent.asset.decimals??7); return createDraft(intent,'STELLAR_PAYMENT',{source:intent.from,sequence:requireField(networkState.sequence,'sequence','STELLAR'),feeBaseUnits:requireField(networkState.baseFeeBaseUnits,'baseFeeBaseUnits','STELLAR'),networkPassphrase:requireField(networkState.networkPassphrase,'networkPassphrase','STELLAR'),operation:{type:'payment',destination:intent.to,asset:'native',amountBaseUnits:amount.toString(),amount:intent.amount}});
}};

const algo:ChainAdapter={chain:'ALGORAND',validateRecipient:validateAlgo,async buildDraft({intent,networkState}){
 requireAvailable(networkState,'ALGORAND');if(!this.validateRecipient(intent.to))throw new Error('Invalid Algorand recipient address.'); const amount=AssetAmountService.decimalToBaseUnits(intent.amount,intent.asset.decimals??6); return createDraft(intent,'ALGORAND_PAYMENT',{sender:intent.from,receiver:intent.to,amountMicroAlgos:amount.toString(),feeMicroAlgos:requireField(networkState.feeBaseUnits,'feeBaseUnits','ALGORAND'),firstRound:requireField(networkState.firstValidRound,'firstValidRound','ALGORAND'),lastRound:requireField(networkState.lastValidRound,'lastValidRound','ALGORAND'),genesisHash:requireField(networkState.genesisHash,'genesisHash','ALGORAND'),genesisId:requireField(networkState.genesisId,'genesisId','ALGORAND')});
}};

export const ChainAdapterFactory={get(chain:SupportedChain):ChainAdapter{switch(chain){case'EVM':return evm;case'BITCOIN':return utxoAdapter('BITCOIN');case'LITECOIN':return utxoAdapter('LITECOIN');case'SOLANA':return solana;case'XRP':return xrp;case'STELLAR':return stellar;case'ALGORAND':return algo;default:{const exhaustive:never=chain;throw new Error(`Unsupported chain adapter: ${String(exhaustive)}`);}}}};
