import { router } from 'expo-router';
import { useState } from 'react';

import { setPin } from '@/security/pin';
import { PinPad } from '@/ui/PinPad';

// Set or change the PIN: enter it twice. Used by onboarding (03) and Settings → Change PIN.
export default function PinSetup() {
  const [first, setFirst] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const complete = async (pin: string) => {
    if (first === null) {
      setFirst(pin);
      setMessage(null);
      return;
    }
    if (pin !== first) {
      setFirst(null);
      setMessage('Those didn’t match. Choose your PIN again.');
      return;
    }
    await setPin(pin);
    router.back();
  };

  return (
    <PinPad
      tone="light"
      title={first === null ? 'Choose a 4-digit PIN' : 'Enter it again'}
      subtitle={first === null ? 'Use it when fingerprint or face unlock isn’t available.' : undefined}
      message={message}
      onComplete={complete}
      onBack={() => (first === null ? router.back() : setFirst(null))}
    />
  );
}
