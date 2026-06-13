import { BaseMockProvider } from './BaseMockProvider';

export class StellarProvider extends BaseMockProvider {
  constructor() {
    super('XLM', 'STELLAR');
  }
}