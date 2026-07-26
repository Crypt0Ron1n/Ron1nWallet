import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ScreenCapture from 'expo-screen-capture';

const SCREEN_PROTECTION_KEY = 'ron1n_screen_protection_enabled_v1';

export class ScreenProtectionService {
  static async isEnabled(): Promise<boolean> {
    try {
      const raw = await AsyncStorage.getItem(SCREEN_PROTECTION_KEY);

      if (raw === null) {
        return true;
      }

      return raw === 'true';
    } catch {
      return true;
    }
  }

  static async setEnabled(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(SCREEN_PROTECTION_KEY, String(enabled));

    if (enabled) {
      await this.enableProtection();
    } else {
      await this.disableProtection();
    }
  }

  static async enableProtection(): Promise<void> {
    try {
      await ScreenCapture.preventScreenCaptureAsync();
    } catch (error) {
      console.warn('Failed to enable screen capture protection:', error);
    }
  }

  static async disableProtection(): Promise<void> {
    try {
      await ScreenCapture.allowScreenCaptureAsync();
    } catch (error) {
      console.warn('Failed to disable screen capture protection:', error);
    }
  }

  static async applySavedPreference(): Promise<void> {
    const enabled = await this.isEnabled();

    if (enabled) {
      await this.enableProtection();
    } else {
      await this.disableProtection();
    }
  }
}