import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PinDots } from './PinDots';
import { PinKeypad } from './PinKeypad';
import { checkPinCode } from '../db/operations';

interface LockScreenProps {
  pinLength: number;
  onUnlock: () => void;
}

const MAX_ATTEMPTS_BEFORE_COOLDOWN = 5;
const COOLDOWN_SECONDS = 30;

export function LockScreen({ pinLength, onUnlock }: LockScreenProps) {
  const { t } = useTranslation();
  const [digits, setDigits] = useState('');
  const [shake, setShake] = useState(false);
  const [checking, setChecking] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [cooldownLeft, setCooldownLeft] = useState(0);

  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const timer = setTimeout(() => setCooldownLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldownLeft]);

  const locked = cooldownLeft > 0 || checking;

  const submit = async (value: string) => {
    setChecking(true);
    const ok = await checkPinCode(value);
    if (ok) {
      onUnlock();
      return;
    }
    setDigits('');
    setShake(true);
    setTimeout(() => setShake(false), 400);
    setChecking(false);
    setFailedAttempts((n) => {
      const next = n + 1;
      if (next >= MAX_ATTEMPTS_BEFORE_COOLDOWN) {
        setCooldownLeft(COOLDOWN_SECONDS);
        return 0;
      }
      return next;
    });
  };

  const handleDigit = (d: string) => {
    if (locked) return;
    const next = digits + d;
    setDigits(next);
    if (next.length >= pinLength) {
      void submit(next);
    }
  };

  const handleBackspace = () => {
    if (locked) return;
    setDigits((d) => d.slice(0, -1));
  };

  return (
    <div className="lock-screen">
      <div className="lock-screen-icon" aria-hidden="true">
        🔒
      </div>
      <h1 className="lock-screen-title">{t('lock.title')}</h1>
      <p className="lock-screen-hint">
        {cooldownLeft > 0
          ? t('lock.cooldown', { seconds: cooldownLeft })
          : failedAttempts > 0
            ? t('lock.wrongPin')
            : t('lock.enterPin')}
      </p>
      <PinDots length={pinLength} filled={digits.length} shake={shake} />
      <PinKeypad onDigit={handleDigit} onBackspace={handleBackspace} disabled={locked} />
    </div>
  );
}
