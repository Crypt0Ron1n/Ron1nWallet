import { BaseMockProvider } from './BaseMockProvider';

export class SolanaProvider extends BaseMockProvider {
  constructor() {
    super('SOL', 'SOLANA');
  }
}