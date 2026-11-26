import { useRouter } from 'expo-router';
import { cloneElement, useState, type ReactElement, type ReactNode } from 'react';
import { Image, Pressable, ScrollView, Switch, View, type ImageSourcePropType } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import EditProfileSheet from '@/components/EditProfileSheet';
import LanguageSheet from '@/components/LanguageSheet';
import OrderBackdrop from '@/components/customer/OrderBackdrop';
import PageHeader from '@/components/PageHeader';
import SegmentedToggle from '@/components/SegmentedToggle';
import SignOutSheet from '@/components/SignOutSheet';
import StatTiles from '@/components/StatTiles';
import { Text } from '@/components/Text';
import { Avatar, Button, SafeAreaView } from '@/components/ui';
import { naira } from '@/lib/format';
import { LANGUAGES, useLanguage } from '@/lib/language';
import { useAssignedMarket } from '@/lib/agentData';
import { useOrders } from '@/lib/orderStore';
import { useWallet, useWalletSync } from '@/lib/wallet';
import { isHistory } from '@/lib/orderStatus';
import { useSession } from '@/lib/session';

const ICON = {
  phone: ['M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z'],
  mail: ['M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z', 'm22 7-10 7L2 7'],
  pin: ['M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z', 'M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z'],
  globe: ['M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z', 'M2 12h20', 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'],
  bell: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'],
  camera: ['M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z', 'M15 13a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z'],
};

const BAG = ['M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z', 'M3 6h18', 'M16 10a4 4 0 0 1-8 0'];
const CLIPBOARD = ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'];

const ROLE_LABEL: Record<string, string> = { customer: 'Customer', agent: 'Agent', rider: 'Rider', shopkeeper: 'Shopkeeper' };

const Glyph = ({ paths, color = '#D9702F', size = 20 }: { paths: string[]; color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    {paths.map((d) => (
      <Path key={d} d={d} />
    ))}
  </Svg>
);

/** One settings line: a peach icon tile, a label, and a value, a switch or a chevron on the right. */
function Row({ icon, label, value, onPress, right, first }: { icon: string[]; label: string; value?: string; onPress?: () => void; right?: ReactNode; first?: boolean }) {
  const body = (
    <View className={'flex-row items-center gap-3 px-4 py-3.5 ' + (first ? '' : 'border-t border-dashed border-line-strong')}>
      <View className="h-10 w-10 items-center justify-center rounded-2xl bg-brand-orange/15">
        <Glyph paths={icon} />
      </View>
      <Text className="text-base font-bold text-ink">{label}</Text>
      <View className="flex-1 items-end">
        {value ? (
          <Text className="text-sm text-muted" numberOfLines={1}>
            {value}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? <Text className="text-2xl text-brand-orange-dark">›</Text> : null)}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" className="active:bg-surface-2">
      {body}
    </Pressable>
  ) : (
    body
  );
}

function ApplyCard({ title, blurb, image, tint, onPress }: { title: string; blurb: string; image: ImageSourcePropType; tint: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-4 overflow-hidden rounded-3xl border border-line bg-surface p-4 shadow-sm active:bg-surface-2"
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
      <View className={`h-[72px] w-[72px] items-center justify-center rounded-2xl ${tint}`}>
        <Image source={image} resizeMode="contain" className="h-[58px] w-[58px]" />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-lg font-extrabold tracking-tight text-ink">{title}</Text>
        <Text className="text-sm leading-5 text-muted">{blurb}</Text>
      </View>
      <Text className="text-2xl text-brand-orange-dark">›</Text>
    </Pressable>
  );
}

// The account page for every role: who you are, your settings, and (for customers) your wallet
// and the ways to start earning with Qyka.
export default function AccountView({ fallbackName }: { fallbackName: string }) {
  const { user, guest, signOut, agentStatus, agentMarket, switchRole } = useSession();
  const { language } = useLanguage();
  const router = useRouter();
  const [switchError, setSwitchError] = useState('');
  const [editing, setEditing] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [pickingLanguage, setPickingLanguage] = useState(false);

  const name = guest ? 'Guest' : user?.full_name || fallbackName;
  const contact = guest ? 'Browsing as a guest' : user?.phone || user?.email || '';
  const customer = user?.role === 'customer' && !guest;
  const agent = user?.role === 'agent';
  const assignedMarket = useAssignedMarket(agent) ?? agentMarket;
  // An approved agent is also a customer, and can switch between the two.
  const canSwitch = agentStatus === 'approved' && user?.has_customer_side !== false && (user?.role === 'customer' || user?.role === 'agent');
  const orders = useOrders();
  useWalletSync(30000);
  const { balance } = useWallet();
  const delivered = orders.filter((o) => o.status === 'delivered' || o.status === 'closed').length;
  const activeCount = orders.filter((o) => !isHistory(o.status)).length;
  const languageName = LANGUAGES.find((l) => l.code === language)?.native ?? 'English';

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={[]}>
      <OrderBackdrop />
      <ScrollView contentContainerClassName="gap-5 px-5 pb-32 pt-3" showsVerticalScrollIndicator={false}>
        <PageHeader top="Your" accent="account" subtitle="Your details and settings" />

        {guest ? null : (
          <Animated.View entering={FadeInDown.delay(60).duration(450)} className="flex-row items-center gap-4 rounded-3xl border border-line bg-surface p-4 shadow-sm">
            <Pressable onPress={() => setEditing(true)} accessibilityRole="button" accessibilityLabel="Change profile photo" className="rounded-full bg-brand-orange/15 p-1.5">
              <Avatar uri={user?.avatar_url} name={name} className="h-[68px] w-[68px]" />
              <View className="absolute -bottom-0.5 -right-0.5 h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-brand-orange">
                <Glyph paths={ICON.camera} color="#1A1A1A" size={14} />
              </View>
            </Pressable>
            <View className="flex-1 gap-1">
              <Text className="text-xl font-extrabold tracking-tight text-ink" numberOfLines={1}>
                {name}
              </Text>
              {contact ? (
                <Text className="text-sm text-muted" numberOfLines={1}>
                  {contact}
                </Text>
              ) : null}
              <View className="self-start rounded-full bg-brand-orange/15 px-2.5 py-0.5">
                <Text className="text-xs font-bold text-brand-orange-dark">{guest ? 'Guest' : ROLE_LABEL[user?.role ?? ''] ?? fallbackName}</Text>
              </View>
            </View>
            {guest ? null : (
              <Pressable
                onPress={() => setEditing(true)}
                accessibilityRole="button"
                accessibilityLabel="Edit profile"
                hitSlop={6}
                className="self-start rounded-full border border-line-strong bg-surface px-3.5 py-1.5 active:bg-sunken">
                <Text className="text-xs font-bold text-ink">Edit</Text>
              </Pressable>
            )}
          </Animated.View>
        )}

        {guest ? (
          <Animated.View entering={FadeInDown.delay(120).duration(450)} className="gap-2 rounded-3xl border-2 border-brand-orange bg-surface p-5 shadow-sm">
            <View className="items-center">
              <Image source={require('../../assets/illustrations/phone-shopping-list.webp')} resizeMode="contain" style={{ width: 150, height: 110 }} />
            </View>
            <Text className="text-lg font-extrabold tracking-tight text-ink">Save your orders</Text>
            <Text className="text-sm leading-5 text-muted">Sign in or create an account to track orders, keep your address and chat with your agent.</Text>
            <Button label="Sign in or create account" className="mt-1" onPress={() => signOut('sign-in')} />
          </Animated.View>
        ) : null}

        {canSwitch ? (
          <Animated.View entering={FadeInDown.delay(100).duration(450)} className="gap-3 rounded-3xl border border-line bg-surface p-4 shadow-sm">
            <View className="gap-0.5">
              <Text className="text-base font-extrabold tracking-tight text-ink">{agent ? 'You’re working as an agent' : 'You’re shopping as a customer'}</Text>
              <Text className="text-sm leading-5 text-muted">{agent ? 'Switch to place your own orders.' : 'Switch to pick up orders as a Qyka agent.'}</Text>
            </View>
            <SegmentedToggle
              value={agent ? 'agent' : 'customer'}
              onChange={async (role) => {
                setSwitchError('');
                try {
                  await switchRole(role);
                } catch (e) {
                  setSwitchError((e as Error).message);
                }
              }}
              segments={[
                { id: 'customer', label: 'Customer', icon: BAG },
                { id: 'agent', label: 'Agent', icon: CLIPBOARD },
              ]}
            />
            {switchError ? <Text className="text-sm font-semibold text-red-700">{switchError}</Text> : null}
          </Animated.View>
        ) : null}

        {customer ? (
          <Animated.View entering={FadeInDown.delay(120).duration(450)}>
            <Pressable
              onPress={() => router.push('/customer/wallet')}
              accessibilityRole="button"
              accessibilityLabel="Open your wallet"
              className="flex-row items-center justify-between rounded-3xl bg-brand-orange/20 px-5 py-4 active:bg-brand-orange/30"
              style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
              <View className="gap-0.5">
                <Text className="text-sm font-semibold text-ink/70">Wallet balance</Text>
                <Text className="text-[32px] font-extrabold leading-[38px] tracking-tight text-ink">{balance === null ? '…' : naira(balance)}</Text>
              </View>
              <View className="items-end gap-1">
                <Text className="max-w-[120px] text-right text-xs leading-4 text-ink/70">Add money, see your history.</Text>
                <Text className="text-xl text-brand-orange-dark">›</Text>
              </View>
            </Pressable>
          </Animated.View>
        ) : null}

        {customer ? (
          <StatTiles
            delay={150}
            items={[
              { value: orders.length, label: 'Orders', art: require('../../assets/illustrations/shop.webp'), tint: 'bg-brand-orange/15' },
              { value: activeCount, label: 'Active', art: require('../../assets/illustrations/track.webp'), tint: 'bg-gold/40', hot: activeCount > 0 },
              { value: delivered, label: 'Delivered', art: require('../../assets/illustrations/order-handoff-vendor-customer.webp'), tint: 'bg-brand-green/15' },
            ]}
          />
        ) : null}

        <Animated.View entering={FadeInDown.delay(180).duration(450)} className="overflow-hidden rounded-3xl border border-line bg-surface shadow-sm">
          {[
            user?.phone ? <Row key="phone" icon={ICON.phone} label="Phone" value={user.phone} /> : null,
            guest ? null : <Row key="email" icon={ICON.mail} label="Email" value={user?.email ?? 'Add your email'} onPress={() => setEditing(true)} />,
            customer ? <Row key="address" icon={ICON.pin} label="Delivery address" value={user?.default_delivery_address ?? 'Not set'} onPress={() => setEditing(true)} /> : null,
            agent && assignedMarket ? <Row key="market" icon={ICON.pin} label="Assigned market" value={assignedMarket} /> : null,
            <Row key="language" icon={ICON.globe} label="Language" value={languageName} onPress={() => setPickingLanguage(true)} />,
            <Row
              key="notifications"
              icon={ICON.bell}
              label="Notifications"
              onPress={() => router.push('/notifications')}
            />,
          ]
            .filter((row): row is ReactElement<{ first?: boolean }> => !!row)
            .map((row, i) => (i === 0 ? cloneElement(row, { first: true }) : row))}
        </Animated.View>

        {customer ? (
          <Animated.View entering={FadeInDown.delay(240).duration(450)} className="gap-3">
            <View className="gap-0.5">
              <Text className="text-lg font-extrabold tracking-tight text-ink">Earn with Qyka</Text>
              <Text className="text-sm text-muted">Your details are filled in for you.</Text>
            </View>
            {agentStatus === 'pending' ? (
              <View className="gap-1.5 rounded-3xl border-2 border-brand-orange/60 bg-surface p-4 shadow-sm">
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="text-lg font-extrabold tracking-tight text-ink">Agent application</Text>
                  <View className="rounded-full bg-brand-orange/15 px-2.5 py-0.5">
                    <Text className="text-xs font-bold text-brand-orange-dark">Under review</Text>
                  </View>
                </View>
                <Text className="text-sm leading-5 text-muted">
                  {agentMarket ? `For ${agentMarket}. ` : ''}We&apos;ll call your guarantors and check your documents. Once you&apos;re approved, you can switch to agent mode right here.
                </Text>
              </View>
            ) : agentStatus === 'none' ? (
              <ApplyCard
                title="Become an agent"
                blurb="Shop the market for customers and earn on every order."
                image={require('../../assets/illustrations/scene-agent-laptop-delivery.webp')}
                tint="bg-brand-green/15"
                onPress={() => router.push({ pathname: '/customer/apply', params: { role: 'agent' } })}
              />
            ) : null}
            <ApplyCard
              title="Become a rider"
              blurb="Deliver orders from a market hub and claim jobs when you want."
              image={require('../../assets/illustrations/char-rider-scooter.webp')}
              tint="bg-gold/40"
              onPress={() => router.push({ pathname: '/customer/apply', params: { role: 'rider' } })}
            />
          </Animated.View>
        ) : null}

        {guest ? null : (
          <Pressable
            onPress={() => setConfirmingSignOut(true)}
            accessibilityRole="button"
            className="min-h-[54px] items-center justify-center rounded-full border border-danger/30 bg-surface active:bg-red-50"
            style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
            <Text className="text-base font-semibold text-danger">Sign out</Text>
          </Pressable>
        )}


        <Text className="text-center text-xs text-faint">Qyka · version 1.0.0</Text>
      </ScrollView>

      <EditProfileSheet visible={editing} onClose={() => setEditing(false)} />
      <SignOutSheet
        visible={confirmingSignOut}
        onClose={() => setConfirmingSignOut(false)}
        onConfirm={() => {
          setConfirmingSignOut(false);
          signOut();
        }}
      />
      <LanguageSheet visible={pickingLanguage} onClose={() => setPickingLanguage(false)} />
    </SafeAreaView>
  );
}
