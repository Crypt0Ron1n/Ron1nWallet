import { BaseMockProvider } from './BaseMockProvider';

export class UtxoProvider extends BaseMockProvider {
  constructor(chain: string) {
    super(chain, 'UTXO');
  }
}