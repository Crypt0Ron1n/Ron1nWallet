import AsyncStorage from '@react-native-async-storage/async-storage';

export type AssetSecurityState =
  | 'STANDARD'
  | 'VAULT_SECURED'
  | 'QUANTUM_READY'
  | 'ROTATION_RECOMMENDED'
  | 'PROTECTED';

export type AssetSecurityRecord = {
  symbol: string;
  state: AssetSecurityState;
  label: string;
  updatedAt: string;
};

const KEY = 'ron1n_asset_security_v1';

function labelFor(state: AssetSecurityState) {
  if (state === 'STANDARD') return 'Standard Asset';
  if (state === 'VAULT_SECURED') return 'Vault Secured';
  if (state === 'QUANTUM_READY') return 'Quantum Ready';
  if (state === 'ROTATION_RECOMMENDED') return 'Rotation Recommended';
  return 'Protected';
}

export class AssetSecurityService {
  static async setState(symbol: string, state: AssetSecurityState) {
    const all = await this.getAll();

    const record: AssetSecurityRecord = {
      symbol,
      state,
      label: labelFor(state),
      updatedAt: new Date().toISOString(),
    };

    const next = all.filter((item) => item.symbol !== symbol);
    next.push(record);

    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    return record;
  }

  static async getState(symbol: string) {
    const all = await this.getAll();
    return all.find((item) => item.symbol === symbol) ?? null;
  }

  static async getAll(): Promise<AssetSecurityRecord[]> {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
}