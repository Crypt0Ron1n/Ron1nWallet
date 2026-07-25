import AsyncStorage from '@react-native-async-storage/async-storage';

export type Ron1nActivityType =
  | 'FORGE'
  | 'RESTORE'
  | 'COPY'
  | 'RECEIVE_VIEW'
  | 'RECOVERY_VIEW'
  | 'SEND_REVIEW'
  | 'SEND_BLOCKED'
  | 'SECURITY'
  | 'SYNC'
  | 'ERROR';

export type Ron1nActivity = {
  id: string;
  type: Ron1nActivityType;
  title: string;
  detail: string;
  createdAt: string;
};

const ACTIVITY_KEY = 'ron1n_activity_v1';
const MAX_ACTIVITY_ITEMS = 150;

export class ActivityService {
  static async addActivity(
    type: Ron1nActivityType,
    title: string,
    detail: string
  ): Promise<void> {
    const current = await this.getActivities();

    const event: Ron1nActivity = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type,
      title,
      detail,
      createdAt: new Date().toISOString(),
    };

    const next = [event, ...current].slice(0, MAX_ACTIVITY_ITEMS);
    await AsyncStorage.setItem(ACTIVITY_KEY, JSON.stringify(next));
  }

  static async getActivities(): Promise<Ron1nActivity[]> {
    try {
      const raw = await AsyncStorage.getItem(ACTIVITY_KEY);

      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter((item) => item && item.id && item.type && item.title)
        .sort((a, b) => {
          const aTime = new Date(a.createdAt || 0).getTime();
          const bTime = new Date(b.createdAt || 0).getTime();
          return bTime - aTime;
        });
    } catch (error) {
      console.warn('Failed to read local activity:', error);
      return [];
    }
  }

  static async clearActivities(): Promise<void> {
    await AsyncStorage.removeItem(ACTIVITY_KEY);
  }
}