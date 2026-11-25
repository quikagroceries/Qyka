import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { fetch } from 'expo/fetch';

// Photos go straight from the phone to Cloudinary (unsigned preset), never
// through our backend, same as the web app. Cloud name and preset are public.
const CLOUD = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || 'y0vuqbu5';
const PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'quika_chat';

/** Opens the camera; resolves to the uploaded photo's URL, or null if the user backed out. */
export async function takeAndUploadPhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error('Camera access is off. Turn it on in Settings to take photos.');
  const shot = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
  if (shot.canceled) return null;

  const form = new FormData();
  form.append('file', new File(shot.assets[0].uri));
  form.append('upload_preset', PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Photo upload failed (${res.status})`);
  return (await res.json()).secure_url as string;
}
