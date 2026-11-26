import { Stack } from 'expo-router';

// Cream behind every screen in the app, so a transition never shows a white or black frame.
export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F0ECE0' } }} />;
}
