import * as SecureStore from 'expo-secure-store';

export interface LocalActivity {
  txHash: string;
  asset: string;
  amount: string;
  type: 'sent' | 'received';
  timestamp: number;
}

const STORAGE_KEY = 'ron1n_local_activity';

export const PrivateActivityService = {
  async saveActivity(activity: LocalActivity[]) {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(activity));
  },
  
  async getActivity(): Promise<LocalActivity[]> {
    const data = await SecureStore.getItemAsync(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },

  async clearActivity() {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
  }
};