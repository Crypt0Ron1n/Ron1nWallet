import AsyncStorage from '@react-native-async-storage/async-storage';

export type StartupDestination = 'SYNDICATE' | 'SHOGUN' | 'SECURITY';

const STARTUP_DESTINATION_KEY = 'ron1n_startup_destination_v1';
const DEFAULT_DESTINATION: StartupDestination = 'SYNDICATE';

function isStartupDestination(value: string | null): value is StartupDestination {
  return value === 'SYNDICATE' || value === 'SHOGUN' || value === 'SECURITY';
}

export class StartupPreferenceService {
  static async getStartupDestination(): Promise<StartupDestination> {
    try {
      const stored = await AsyncStorage.getItem(STARTUP_DESTINATION_KEY);
      return isStartupDestination(stored) ? stored : DEFAULT_DESTINATION;
    } catch {
      return DEFAULT_DESTINATION;
    }
  }

  static async setStartupDestination(destination: StartupDestination): Promise<void> {
    await AsyncStorage.setItem(STARTUP_DESTINATION_KEY, destination);
  }
}
