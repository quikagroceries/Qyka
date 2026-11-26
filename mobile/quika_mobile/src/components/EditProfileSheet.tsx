import AddressPicker, { type AddressValue } from '@/components/AddressPicker';
import { useState } from 'react';
import Svg, { Path } from 'react-native-svg';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';

import { Text } from '@/components/Text';
import { Avatar, Button, Field } from '@/components/ui';
import { pickPhoto } from '@/lib/pickPhoto';
import { useAssignedMarket } from '@/lib/agentData';
import { isEmail } from '@/lib/validate';
import { useSession } from '@/lib/session';

const CAMERA = ['M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z', 'M15 13a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z'];
const IMAGE = ['M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Z', 'M9 9.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z', 'm21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21'];
const TRASH = ['M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2', 'M10 11v6', 'M14 11v6'];
const LOCK = ['M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2Z', 'M7 11V7a5 5 0 0 1 10 0v4'];

/** One photo action: an icon over its label, in an equal-width tile. */
function PhotoAction({ icon, label, onPress, disabled, danger }: { icon: string[]; label: string; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  const color = danger ? '#B3261E' : '#D9702F';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={'flex-1 items-center gap-1.5 rounded-2xl border bg-surface py-3 active:bg-sunken ' + (danger ? 'border-red-200' : 'border-line') + (disabled ? ' opacity-60' : '')}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}>
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {icon.map((d) => (
          <Path key={d} d={d} />
        ))}
      </Svg>
      <Text className={'text-xs font-bold ' + (danger ? 'text-red-700' : 'text-ink')}>{label}</Text>
    </Pressable>
  );
}

/** A detail you can see but not change here: a normal white field, with a lock (or a Verified badge) so it reads as locked on purpose. */
function LockedField({ value, verified }: { value: string; verified?: boolean }) {
  return (
    <View className="min-h-[54px] flex-row items-center justify-between gap-3 rounded-full border border-line bg-surface pl-5 pr-4">
      <Text className="flex-1 text-base text-ink" numberOfLines={1}>
        {value}
      </Text>
      {verified ? (
        <View className="flex-row items-center gap-1 rounded-full bg-brand-green/20 px-2.5 py-1">
          <Text className="text-[11px] font-extrabold text-brand-army">✓</Text>
          <Text className="text-[11px] font-bold text-brand-army">Verified</Text>
        </View>
      ) : (
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#8A7F74" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          {LOCK.map((d) => (
            <Path key={d} d={d} />
          ))}
        </Svg>
      )}
    </View>
  );
}

const Label = ({ children }: { children: string }) => <Text className="mb-1.5 ml-2 text-xs font-bold uppercase tracking-wide text-faint">{children}</Text>;

/** The form inside the sheet. It mounts when the sheet opens, so it always starts from the saved details. */
function Form({ onClose }: { onClose: () => void }) {
  const { user, updateUser, agentMarket } = useSession();
  const realMarket = useAssignedMarket(user?.role === 'agent');
  const assignedMarket = realMarket ?? agentMarket;
  const customer = user?.role === 'customer';
  const [name, setName] = useState(user?.full_name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [avatar, setAvatar] = useState<string | null>(user?.avatar_url ?? null);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [place, setPlace] = useState<AddressValue>({ address: user?.default_delivery_address ?? '', landmark: user?.default_delivery_landmark ?? '', latitude: user?.default_delivery_latitude ?? null, longitude: user?.default_delivery_longitude ?? null });
  const [error, setError] = useState('');
  const agent = user?.role === 'agent';

  const changePhoto = async (source: 'camera' | 'library') => {
    setPicking(true);
    const uri = await pickPhoto(source, { front: true });
    setPicking(false);
    if (uri) setAvatar(uri);
  };

  const save = async () => {
    if (!name.trim()) return setError('Your name can’t be empty');
    if (email.trim() && !isEmail(email)) return setError('That doesn’t look like an email address');
    setSaving(true);
    try {
      // Name and address are saved to the server; email and photo stay on this phone for now.
      await updateUser({ full_name: name.trim(), email: email.trim() || null, avatar_url: avatar, ...(customer ? { default_delivery_address: place.address.trim() || null, default_delivery_landmark: place.landmark.trim() || null, default_delivery_latitude: place.latitude, default_delivery_longitude: place.longitude } : {}) });
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <View className="gap-4">
      <View className="items-center gap-1">
        <Text className="text-2xl font-extrabold tracking-tight text-ink">
          Edit your <Text className="text-2xl font-extrabold tracking-tight text-brand-orange-dark">details</Text>
        </Text>
        <Text className="text-sm text-muted">{agent ? 'Customers see your name and photo on their orders.' : 'These are what your agent and rider see.'}</Text>
      </View>

      <View className="items-center gap-3">
        <View className="rounded-full bg-brand-orange/15 p-1.5">
          <Avatar uri={avatar} name={name || user?.full_name} className="h-24 w-24" />
        </View>
        <View className="w-full flex-row gap-2">
          <PhotoAction icon={CAMERA} label={picking ? 'Opening…' : 'Take photo'} disabled={picking} onPress={() => changePhoto('camera')} />
          <PhotoAction icon={IMAGE} label="Library" disabled={picking} onPress={() => changePhoto('library')} />
          {avatar ? <PhotoAction icon={TRASH} label="Remove" danger onPress={() => setAvatar(null)} /> : null}
        </View>
      </View>

      <View>
        <Label>Full name</Label>
        <Field value={name} onChangeText={(t) => { setName(t); setError(''); }} placeholder="Your name" autoCapitalize="words" textContentType="name" />
      </View>

      {user?.phone ? (
        <View>
          <Label>Phone</Label>
          <LockedField value={user.phone} verified />
          <Text className="ml-2 mt-1.5 text-xs text-faint">This is how you sign in, so it can&apos;t be changed here.</Text>
        </View>
      ) : null}

      <View>
        <Label>Email</Label>
        <Field value={email} onChangeText={(t) => { setEmail(t); setError(''); }} placeholder="you@example.com" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" />
      </View>

      {agent && assignedMarket ? (
        <View>
          <Label>Assigned market</Label>
          <LockedField value={assignedMarket} />
          <Text className="ml-2 mt-1.5 text-xs text-faint">Qyka sets your market. Contact support to change it.</Text>
        </View>
      ) : null}

      {customer ? (
        <View>
          <Label>Delivery address</Label>
          <AddressPicker value={place} onChange={setPlace} />
        </View>
      ) : null}

      {error ? <Text className="ml-2 text-xs font-semibold text-red-700">{error}</Text> : null}

      <View className="gap-2 pt-1">
        <Button label="Save changes" busy={saving} onPress={save} />
        <Pressable onPress={onClose} hitSlop={8} className="items-center py-2">
          <Text className="text-sm font-bold text-brand-orange-dark">Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Bottom sheet for editing your name and (for customers) your saved delivery address. */
export default function EditProfileSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { height } = useWindowDimensions();
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <Animated.View entering={FadeIn.duration(200)} className="flex-1 justify-end bg-black/40">
          <Pressable className="flex-1" onPress={onClose} accessibilityLabel="Close" />
          <Animated.View entering={SlideInDown.duration(320)} className="gap-4 rounded-t-[32px] bg-canvas px-5 pb-10 pt-3">
            <View className="h-1.5 w-10 self-center rounded-full bg-line-strong" />
            {visible ? (
              <ScrollView style={{ maxHeight: height * 0.78 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Form onClose={onClose} />
              </ScrollView>
            ) : null}
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
