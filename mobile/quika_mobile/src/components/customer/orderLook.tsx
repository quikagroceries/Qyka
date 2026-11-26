import { View } from 'react-native';

import { Text } from '@/components/Text';
import type { ImageSourcePropType } from 'react-native';

import { ON_THE_MOVE } from '@/lib/orderStatus';
import type { AgentOrder } from '@/lib/types';

export const PROBLEM = new Set(['cancelled', 'cancelled_unpaid', 'disputed']);

const ART = {
  proposed: require('../../../assets/illustrations/market-cart-vendor.webp'),
  shopping: require('../../../assets/illustrations/agent-customer-conversation.webp'),
  moving: require('../../../assets/illustrations/rider-scooter-basket-1.webp'),
  done: require('../../../assets/illustrations/order-handoff-vendor-customer.webp'),
};

/** Which illustration and tint an order gets, by how far along it is. */
export function look(o: Pick<AgentOrder, 'status'>): { art: ImageSourcePropType; tint: string } {
  if (PROBLEM.has(o.status)) return { art: ART.proposed, tint: 'bg-red-50' };
  if (o.status === 'delivered' || o.status === 'closed') return { art: ART.done, tint: 'bg-brand-green/15' };
  if (ON_THE_MOVE.has(o.status)) return { art: ART.moving, tint: 'bg-gold/40' };
  if (o.status === 'shopping' || o.status === 'awaiting_payment') return { art: ART.shopping, tint: 'bg-brand-orange/15' };
  return { art: ART.proposed, tint: 'bg-brand-orange/15' };
}

/** Placed -> shopping -> on the way -> delivered. */
export function stage(status: string): number {
  if (status === 'delivered' || status === 'closed') return 4;
  if (ON_THE_MOVE.has(status)) return 3;
  if (status === 'shopping' || status === 'awaiting_payment') return 2;
  return 1;
}

const STAGES = ['Placed', 'Shopping', 'On the way', 'Delivered'];

/** Four-step bar. With `labels`, each name sits under its own segment; the current one is bold. */
export function Progress({ status, labels }: { status: string; labels?: boolean }) {
  const at = stage(status);
  return (
    <View className="w-full flex-row gap-1.5">
      {STAGES.map((label, i) => {
        const n = i + 1;
        return (
          <View key={label} style={{ flex: 1, minWidth: 0 }} className="gap-1.5">
            <View className={'h-1.5 rounded-full ' + (n <= at ? (at === 4 ? 'bg-brand-army' : 'bg-brand-orange') : 'bg-line-strong')} />
            {labels ? (
              <Text numberOfLines={1} className={'text-center text-[11px] ' + (n === at ? 'font-extrabold text-ink' : n < at ? 'font-semibold text-muted' : 'font-semibold text-faint')}>
                {label}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
