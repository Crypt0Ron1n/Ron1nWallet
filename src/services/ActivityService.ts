import AsyncStorage from '@react-native-async-storage/async-storage';

export type Ron1nActivityType =
  | 'FORGE'
  | 'RESTORE'
  | 'COPY'
  | 'RECEIVE_VIEW'
  | 'RECOVERY_VIEW'
  | 'SEND_REVIEW'
  | 'SEND_BLOCKED'
  | 'SECURITY';

export type Ron1nActivity = {
  id: string;
  type: Ron1nActivityType;
  title: string;
  detail: string;
  createdAt: string;
};

const ACTIVITY_KEY = 'ron1n_activity_v1';

export class ActivityService {
  static async addActivity(
    type: Ron1nActivityType,
    title: string,
    detail: string
  ) {
    const current = await this.getActivities();

    const event: Ron1nActivity = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type,
      title,
      detail,
      createdAt: new Date().toISOString(),
    };

    const next = [event, ...current].slice(0, 100);
    await AsyncStorage.setItem(ACTIVITY_KEY, JSON.stringify(next));
  }

  static async getActivities(): Promise<Ron1nActivity[]> {
    try {
      const raw = await AsyncStorage.getItem(ACTIVITY_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  static async clearActivities() {
    await AsyncStorage.removeItem(ACTIVITY_KEY);
  }
}