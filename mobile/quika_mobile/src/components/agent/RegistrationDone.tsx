import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Image, ScrollView, Share, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import OrderBackdrop from '@/components/customer/OrderBackdrop';
import { Text } from '@/components/Text';
import { Button, Float, SafeAreaView } from '@/components/ui';

/** The thank-you page after a registration: what happens next, and the link to send each guarantor. */
export default function RegistrationDone({ name, assignLine, linkCode, fullName, onExit }: { name: string; assignLine: string; linkCode: string; fullName: string; onExit: () => void }) {
  const [copied, setCopied] = useState(false);
  const link = `https://qyka.app/guarantor/${linkCode}`;
  const copy = async () => {
    await Clipboard.setStringAsync(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const share = () => Share.share({ message: `Please complete your guarantor verification for ${fullName} on Qyka: ${link}` });

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <OrderBackdrop />
      <ScrollView contentContainerClassName="gap-5 px-5 pb-12 pt-6" showsVerticalScrollIndicator={false}>
        <View className="items-center gap-2">
          <Animated.View entering={FadeInDown.duration(500)}>
            <Float>
              <Image source={require('../../../assets/illustrations/handshake.webp')} resizeMode="contain" style={{ width: 190, height: 140 }} />
            </Float>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(100).duration(500)} className="items-center gap-2">
            <Text className="text-center text-[30px] font-extrabold leading-[36px] tracking-tight text-ink">
              Thank you,{'\n'}
              <Text className="text-[30px] font-extrabold leading-[36px] tracking-tight text-brand-orange-dark">{name}</Text>
            </Text>
            <Text className="max-w-[310px] text-center text-base leading-6 text-muted">We&apos;ve received your registration. Here&apos;s what happens next.</Text>
          </Animated.View>
        </View>

        <Animated.View entering={FadeInDown.delay(150).duration(450)} className="gap-3 rounded-3xl border border-line bg-surface p-5 shadow-sm">
          {[
            ['1', 'Send the link below to both guarantors', 'Each one fills in their own verification form.'],
            ['2', 'We call your guarantors', 'The Qyka team confirms their details and consent.'],
            ['3', 'We check your documents', 'Your ID, address proof and selfie are reviewed.'],
            ['4', 'You start', assignLine],
          ].map(([n, t, d]) => (
            <View key={n} className="flex-row items-start gap-3">
              <View className="h-7 w-7 items-center justify-center rounded-full bg-brand-orange/20">
                <Text className="text-xs font-extrabold text-brand-orange-dark">{n}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-ink">{t}</Text>
                <Text className="text-xs leading-4 text-muted">{d}</Text>
              </View>
            </View>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(250).duration(450)} className="gap-3 rounded-3xl border-2 border-brand-orange/60 bg-surface p-5 shadow-sm">
          <Text className="text-lg font-extrabold tracking-tight text-ink">Share this with your guarantors</Text>
          <Text className="text-sm leading-5 text-muted">Kindly copy the link and send it to both of your guarantors so they can complete their verification.</Text>
          <View className="rounded-2xl bg-sunken px-4 py-3">
            <Text selectable className="text-sm font-semibold text-ink" numberOfLines={1}>
              {link}
            </Text>
          </View>
          <View className="flex-row gap-2">
            <Button label={copied ? 'Copied ✓' : 'Copy link'} className="flex-1" onPress={copy} />
            <Button label="Share" variant="outline" className="flex-1" onPress={share} />
          </View>
        </Animated.View>

        <Button label="Back to my account" variant="neutral" onPress={onExit} />
      </ScrollView>
    </SafeAreaView>
  );
}
