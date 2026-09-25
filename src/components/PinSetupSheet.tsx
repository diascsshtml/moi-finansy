import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet } from './Sheet';
import { PinDots } from './PinDots';
import { PinKeypad } from './PinKeypad';
import { useSettings } from '../context/SettingsContext';
import { checkPinCode, clearPinCode, setPinCode } from '../db/operations';
import { PIN_MAX_LENGTH, PIN_MIN_LENGTH } from '../utils/pin';

export type PinSetupMode = 'create' | 'change' | 'disable';

interface PinSetupSheetProps {
  onClose: () => void;
  mode: PinSetupMode;
}

type Step = 'verify-current' | 'enter-new' | 'confirm-new';

export function PinSetupSheet({ onClose, mode }: PinSetupSheetProps) {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [step, setStep] = useState<Step>(mode === 'create' ? 'enter-new' : 'verify-current');
  const [digits, setDigits] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);

  const doShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  const handleVerifyCurrent = async (value: string) => {
    setBusy(true);
    const ok = await checkPinCode(value);
    setBusy(false);
    if (!ok) {
      setDigits('');
      setError(t('lock.wrongPin'));
      doShake();
      return;
    }
    setError(null);
    setDigits('');
    if (mode === 'disable') {
      await clearPinCode();
      onClose();
    } else {
      setStep('enter-new');
    }
  };

  const handleConfirmNew = async (value: string) => {
    if (value !== firstPin) {
      setError(t('lock.pinMismatch'));
      doShake();
      setDigits('');
      setFirstPin('');
      setStep('enter-new');
      return;
    }
    setBusy(true);
    await setPinCode(firstPin);
    setBusy(false);
    onClose();
  };

  const handleDigit = (d: string) => {
    if (busy) return;
    setError(null);
    const next = digits + d;

    if (step === 'verify-current') {
      const targetLen = settings.pinLength ?? PIN_MIN_LENGTH;
      setDigits(next);
      if (next.length >= targetLen) void handleVerifyCurrent(next);
      return;
    }

    if (step === 'enter-new') {
      if (next.length > PIN_MAX_LENGTH) return;
      setDigits(next);
      return;
    }

    // confirm-new
    setDigits(next);
    if (next.length >= firstPin.length) void handleConfirmNew(next);
  };

  const handleBackspace = () => {
    if (busy) return;
    setDigits((d) => d.slice(0, -1));
  };

  const handleNewPinNext = () => {
    if (digits.length < PIN_MIN_LENGTH) return;
    setFirstPin(digits);
    setDigits('');
    setStep('confirm-new');
  };

  const title =
    mode === 'disable'
      ? t('lock.disableTitle')
      : mode === 'change'
        ? t('lock.changeTitle')
        : t('lock.createTitle');

  const hint =
    step === 'verify-current'
      ? t('lock.enterCurrentPin')
      : step === 'enter-new'
        ? t('lock.chooseNewPin')
        : t('lock.confirmNewPin');

  const dotsLength =
    step === 'verify-current' ? settings.pinLength ?? PIN_MIN_LENGTH : step === 'confirm-new' ? firstPin.length : PIN_MAX_LENGTH;

  return (
    <Sheet title={title} onClose={onClose}>
      <div className="pin-setup">
        <p className="lock-screen-hint">{hint}</p>
        <PinDots length={dotsLength} filled={digits.length} shake={shake} />
        {error && <p className="field-error pin-setup-error">{error}</p>}
        <PinKeypad onDigit={handleDigit} onBackspace={handleBackspace} disabled={busy} />
        {step === 'enter-new' && (
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={digits.length < PIN_MIN_LENGTH}
            onClick={handleNewPinNext}
          >
            {t('common.next')}
          </button>
        )}
      </div>
    </Sheet>
  );
}
