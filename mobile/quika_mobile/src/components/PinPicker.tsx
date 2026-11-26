import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import MapView, { Marker, type MapPressEvent, type MarkerDragStartEndEvent } from 'react-native-maps';

import { Text } from '@/components/Text';
import { Button, SafeAreaView } from '@/components/ui';

type Pin = { latitude: number; longitude: number };

// Where the map opens when there is no pin yet: central Lagos.
const LAGOS: Pin = { latitude: 6.5244, longitude: 3.3792 };

/**
 * Full-screen map for fixing exactly where to deliver: tap the map or drag the pin, then confirm. Nigerian addresses are often vague,
 * so this is what makes the pin trustworthy. The parent asks the server whether the new spot is deliverable.
 */
export default function PinPicker({ visible, start, onConfirm, onClose }: { visible: boolean; start: Pin | null; onConfirm: (pin: Pin) => void; onClose: () => void }) {
  const [pin, setPin] = useState<Pin>(start ?? LAGOS);
  const [seen, setSeen] = useState(visible);
  // Each time it opens, begin from the current pin (adjusting state during render, not in an effect).
  if (visible !== seen) {
    setSeen(visible);
    if (visible) setPin(start ?? LAGOS);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'bottom']}>
        <View className="flex-row items-center justify-between px-5 py-3">
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close" className="h-11 w-11 items-center justify-center rounded-full bg-surface shadow-sm active:bg-sunken">
            <Text className="text-xl text-ink">✕</Text>
          </Pressable>
          <Text className="text-base font-extrabold text-ink">Move the pin to your door</Text>
          <View className="h-11 w-11" />
        </View>
        <MapView
          style={{ flex: 1 }}
          initialRegion={{ ...pin, latitudeDelta: start ? 0.006 : 0.12, longitudeDelta: start ? 0.006 : 0.12 }}
          onPress={(e: MapPressEvent) => setPin(e.nativeEvent.coordinate)}>
          <Marker coordinate={pin} draggable onDragEnd={(e: MarkerDragStartEndEvent) => setPin(e.nativeEvent.coordinate)} pinColor="#EE9A5A" />
        </MapView>
        <View className="gap-2 px-5 pb-4 pt-3">
          <Text className="text-center text-xs text-muted">Tap the map or drag the pin to the exact spot.</Text>
          <Button label="Use this spot" onPress={() => onConfirm(pin)} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
