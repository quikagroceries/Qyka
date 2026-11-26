import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

/**
 * Takes a photo or picks one from the library and returns its local uri, or null if cancelled,
 * denied or unavailable (it tells the person why). UI only: nothing is uploaded.
 */
export async function pickPhoto(source: 'camera' | 'library', options?: { front?: boolean; devFallback?: boolean }): Promise<string | null> {
  try {
    const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(source === 'camera' ? 'Camera access is off' : 'Photo access is off', 'Turn it on for Qyka in your phone settings to add pictures.');
      return null;
    }
    const result = source === 'camera' ? await ImagePicker.launchCameraAsync({ quality: 0.7, cameraType: options?.front ? ImagePicker.CameraType.front : ImagePicker.CameraType.back }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    return !result.canceled && result.assets[0] ? result.assets[0].uri : null;
  } catch {
    // Development only: a simulator has no camera, so pick from the library instead and the flow can still be tested.
    if (__DEV__ && source === 'camera' && options?.devFallback) return pickPhoto('library');
    Alert.alert(source === 'camera' ? "The camera isn't available" : "Couldn't open your photos", source === 'camera' ? 'Try choosing a photo from your library instead.' : 'Please try again.');
    return null;
  }
}
