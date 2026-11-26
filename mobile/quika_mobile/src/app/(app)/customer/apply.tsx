import { useLocalSearchParams, useRouter } from 'expo-router';

import AgentRegistration from '@/components/agent/AgentRegistration';
import RiderRegistration from '@/components/agent/RiderRegistration';

// Apply to become an agent or a rider, each through its own full registration.
export default function Apply() {
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role?: string }>();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/customer'));
  return role === 'rider' ? <RiderRegistration onExit={back} /> : <AgentRegistration onExit={back} />;
}
