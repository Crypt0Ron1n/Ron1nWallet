import AsyncStorage from '@react-native-async-storage/async-storage';

export type AddressRotationRecord = {
  symbol: string;
  oldAddress: string;
  newAddressLabel: string;
  derivationIndex: number;
  createdAt: string;
  status: 'READY' | 'COMPLETED';
};

const KEY = 'ron1n_address_rotation_v1';

export class AddressRotationService {
  static async prepareRotation(symbol: string, oldAddress: string) {
    const all = await this.getAll();
    const nextIndex = all.filter((item) => item.symbol === symbol).length + 1;

    const record: AddressRotationRecord = {
      symbol,
      oldAddress,
      newAddressLabel: `${symbol} Fresh Address Index ${nextIndex}`,
      derivationIndex: nextIndex,
      createdAt: new Date().toISOString(),
      status: 'READY',
    };

    await AsyncStorage.setItem(KEY, JSON.stringify([record, ...all]));
    return record;
  }

  static async getAll(): Promise<AddressRotationRecord[]> {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
}