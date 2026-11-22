import React, { useState, useEffect, useCallback } from 'react';
import { 
  Lock, 
  Unlock, 
  ShieldCheck, 
  ShieldAlert, 
  X, 
  Delete, 
  KeyRound, 
  Check, 
  AlertCircle 
} from 'lucide-react';
import { getSettings, saveSettings } from '../../services/db';
import { AppSettings } from '../../types';

export interface PinLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mode?: 'unlock' | 'set' | 'change';
  title?: string;
  description?: string;
}

const KEYPAD_BUTTONS = [
  { digit: '1', sub: '' },
  { digit: '2', sub: 'ABC' },
  { digit: '3', sub: 'DEF' },
  { digit: '4', sub: 'GHI' },
  { digit: '5', sub: 'JKL' },
  { digit: '6', sub: 'MNO' },
  { digit: '7', sub: 'PQRS' },
  { digit: '8', sub: 'TUV' },
  { digit: '9', sub: 'WXYZ' },
];

export const PinLockModal: React.FC<PinLockModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  mode: initialMode = 'unlock',
  title: customTitle,
  description: customDescription,
}) => {
  const [currentMode, setCurrentMode] = useState<'unlock' | 'set' | 'change'>(initialMode);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [pin, setPin] = useState<string>('');
  const [firstPin, setFirstPin] = useState<string>(''); // For set/confirm flow
  const [step, setStep] = useState<number>(1); // Step 1, 2, or 3 depending on mode
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load app settings
  useEffect(() => {
    if (isOpen) {
      setCurrentMode(initialMode);
      setPin('');
      setFirstPin('');
      setStep(1);
      setErrorMsg('');
      setIsShaking(false);
      setIsLoading(true);

      getSettings().then((s) => {
        setSettings(s);
        setIsLoading(false);
      }).catch((err) => {
        console.error('Failed to load settings:', err);
        setIsLoading(false);
      });
    }
  }, [isOpen, initialMode]);

  const triggerShake = (msg: string) => {
    setErrorMsg(msg);
    setIsShaking(true);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([80, 50, 80]);
      } catch (e) {
        // ignore
      }
    }
    setTimeout(() => {
      setIsShaking(false);
      setPin('');
    }, 600);
  };

  const handleDigitPress = useCallback((digit: string) => {
    if (pin.length >= 4 || isShaking) return;
    const newPin = pin + digit;
    setPin(newPin);
    setErrorMsg('');

    if (newPin.length === 4) {
      // Process 4-digit PIN entry
      handlePinComplete(newPin);
    }
  }, [pin, isShaking]);

  const handleDeletePress = useCallback(() => {
    if (isShaking) return;
    setPin((prev) => prev.slice(0, -1));
    setErrorMsg('');
  }, [isShaking]);

  // Keyboard navigation support
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigitPress(e.key);
      } else if (e.key === 'Backspace') {
        handleDeletePress();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleDigitPress, handleDeletePress, onClose]);

  const handlePinComplete = async (enteredPin: string) => {
    if (!settings) return;

    if (currentMode === 'unlock') {
      const correctPin = settings.pinCode;
      if (!correctPin || enteredPin === correctPin) {
        // Unlocked successfully
        onSuccess();
        onClose();
      } else {
        triggerShake('Incorrect PIN. Please try again.');
      }
    } else if (currentMode === 'set') {
      if (step === 1) {
        // Save first entered PIN and prompt confirmation
        setFirstPin(enteredPin);
        setStep(2);
        setPin('');
      } else if (step === 2) {
        if (enteredPin === firstPin) {
          // Success! Save PIN
          const updated = { ...settings, pinCode: enteredPin };
          await saveSettings(updated);
          setSettings(updated);
          onSuccess();
          onClose();
        } else {
          triggerShake('PINs did not match. Enter PIN again.');
          setStep(1);
          setFirstPin('');
        }
      }
    } else if (currentMode === 'change') {
      if (step === 1) {
        // Verify current PIN
        if (enteredPin === settings.pinCode) {
          setStep(2);
          setPin('');
        } else {
          triggerShake('Incorrect current PIN');
        }
      } else if (step === 2) {
        setFirstPin(enteredPin);
        setStep(3);
        setPin('');
      } else if (step === 3) {
        if (enteredPin === firstPin) {
          const updated = { ...settings, pinCode: enteredPin };
          await saveSettings(updated);
          setSettings(updated);
          onSuccess();
          onClose();
        } else {
          triggerShake('PINs did not match. Try again.');
          setStep(2);
          setFirstPin('');
        }
      }
    }
  };

  // Immediate unlock if no PIN is configured in unlock mode
  const handleDirectUnlock = () => {
    onSuccess();
    onClose();
  };

  if (!isOpen) return null;

  const hasPinConfigured = Boolean(settings?.pinCode);

  // Compute title & instructions
  const getHeaderInfo = () => {
    if (customTitle && currentMode === 'unlock') {
      return {
        title: customTitle,
        desc: customDescription || 'Enter your 4-digit PIN to access confidential files',
      };
    }

    if (currentMode === 'unlock') {
      if (!hasPinConfigured) {
        return {
          title: 'Vault Unlocked',
          desc: 'No security PIN is currently required for hidden documents.',
        };
      }
      return {
        title: 'Hidden Vault Locked',
        desc: 'Enter your 4-digit PIN to access private documents',
      };
    }

    if (currentMode === 'set') {
      if (step === 1) {
        return {
          title: 'Create Security PIN',
          desc: 'Enter a 4-digit PIN to protect your secret documents',
        };
      }
      return {
        title: 'Confirm Security PIN',
        desc: 'Re-enter your 4-digit PIN to confirm',
      };
    }

    if (currentMode === 'change') {
      if (step === 1) {
        return {
          title: 'Enter Current PIN',
          desc: 'Verify your existing 4-digit PIN first',
        };
      }
      if (step === 2) {
        return {
          title: 'Enter New PIN',
          desc: 'Choose a new 4-digit security PIN',
        };
      }
      return {
        title: 'Confirm New PIN',
        desc: 'Re-enter your new PIN to confirm',
      };
    }

    return { title: 'Security PIN', desc: '' };
  };

  const headerInfo = getHeaderInfo();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Dimmed backdrop */}
      <div 
        className="fixed inset-0 bg-black/65 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div 
        role="dialog"
        aria-modal="true"
        className="glass-modal relative w-full max-w-sm rounded-3xl border border-white/20 dark:border-white/10 shadow-2xl bg-white dark:bg-zinc-900 p-6 flex flex-col items-center select-none overflow-hidden"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center justify-center transition-colors"
          aria-label="Close PIN modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Shield / Vault Icon */}
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-500/20 via-orange-500/20 to-amber-600/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center mb-3 shadow-lg shadow-amber-500/10">
          {currentMode === 'unlock' && !hasPinConfigured ? (
            <Unlock className="w-8 h-8 stroke-[2]" />
          ) : (
            <Lock className="w-8 h-8 stroke-[2]" />
          )}
        </div>

        {/* Title & Description */}
        <div className="text-center mb-5 px-2">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {headerInfo.title}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {headerInfo.desc}
          </p>
        </div>

        {/* If Unlock Mode and No PIN Configured: Quick Unlock / Setup choice */}
        {currentMode === 'unlock' && !hasPinConfigured && !isLoading ? (
          <div className="w-full space-y-3 pt-2 pb-1">
            <button
              type="button"
              onClick={handleDirectUnlock}
              className="w-full py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-semibold text-sm shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all"
            >
              <Unlock className="w-4 h-4 stroke-[2.2]" />
              <span>Unlock Vault Now</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setCurrentMode('set');
                setStep(1);
                setPin('');
                setErrorMsg('');
              }}
              className="w-full py-3 px-4 rounded-2xl bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 active:scale-98 text-gray-800 dark:text-gray-200 font-semibold text-xs flex items-center justify-center gap-2 transition-all"
            >
              <KeyRound className="w-4 h-4 text-amber-500 stroke-[2.2]" />
              <span>Set a 4-Digit Protection PIN</span>
            </button>
          </div>
        ) : (
          <>
            {/* 4 Digit Dots Indicator */}
            <div 
              className={`flex items-center justify-center gap-4 my-4 ${
                isShaking ? 'animate-[shake_0.5s_ease-in-out]' : ''
              }`}
              style={{
                animation: isShaking ? 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both' : undefined,
              }}
            >
              <style>{`
                @keyframes shake {
                  10%, 90% { transform: translate3d(-2px, 0, 0); }
                  20%, 80% { transform: translate3d(4px, 0, 0); }
                  30%, 50%, 70% { transform: translate3d(-6px, 0, 0); }
                  40%, 60% { transform: translate3d(6px, 0, 0); }
                }
              `}</style>

              {[0, 1, 2, 3].map((index) => {
                const isFilled = pin.length > index;
                return (
                  <div
                    key={index}
                    className={`transition-all duration-200 rounded-full flex items-center justify-center ${
                      isFilled
                        ? 'w-4 h-4 bg-blue-600 dark:bg-blue-400 scale-110 shadow-sm shadow-blue-500/30'
                        : 'w-4 h-4 border-2 border-gray-300 dark:border-zinc-700 bg-transparent'
                    }`}
                  />
                );
              })}
            </div>

            {/* Error Message */}
            {errorMsg ? (
              <p className="text-xs text-red-500 font-semibold mb-3 flex items-center gap-1 text-center">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMsg}</span>
              </p>
            ) : (
              <div className="h-4 mb-3" />
            )}

            {/* Numeric Keypad Grid */}
            <div className="w-full max-w-[260px] grid grid-cols-3 gap-3">
              {KEYPAD_BUTTONS.map((item) => (
                <button
                  key={item.digit}
                  type="button"
                  onClick={() => handleDigitPress(item.digit)}
                  className="w-16 h-16 rounded-full bg-gray-100/90 dark:bg-zinc-800/80 hover:bg-gray-200 dark:hover:bg-zinc-700 active:bg-blue-600 active:text-white dark:active:bg-blue-500 active:scale-92 transition-all flex flex-col items-center justify-center shadow-xs mx-auto text-gray-900 dark:text-white"
                >
                  <span className="text-xl font-bold leading-none">{item.digit}</span>
                  {item.sub && (
                    <span className="text-[9px] font-semibold tracking-wider text-gray-400 dark:text-gray-500 leading-none mt-0.5">
                      {item.sub}
                    </span>
                  )}
                </button>
              ))}

              {/* Bottom Row */}
              {/* Left action button: Cancel / Reset */}
              <button
                type="button"
                onClick={onClose}
                className="w-16 h-16 rounded-full flex items-center justify-center text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white active:scale-95 transition-all mx-auto"
              >
                Cancel
              </button>

              {/* 0 Button */}
              <button
                type="button"
                onClick={() => handleDigitPress('0')}
                className="w-16 h-16 rounded-full bg-gray-100/90 dark:bg-zinc-800/80 hover:bg-gray-200 dark:hover:bg-zinc-700 active:bg-blue-600 active:text-white dark:active:bg-blue-500 active:scale-92 transition-all flex items-center justify-center shadow-xs mx-auto text-gray-900 dark:text-white"
              >
                <span className="text-xl font-bold">0</span>
              </button>

              {/* Backspace Button */}
              <button
                type="button"
                onClick={handleDeletePress}
                className="w-16 h-16 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white active:scale-90 transition-all mx-auto"
                aria-label="Delete last digit"
              >
                <Delete className="w-5 h-5 stroke-[2]" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
