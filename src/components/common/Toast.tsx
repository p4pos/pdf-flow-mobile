import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  Lock, 
  X, 
  LucideIcon 
} from 'lucide-react';

export type ToastType = 'success' | 'info' | 'warning' | 'error' | 'vault';

export interface ToastMessage {
  id: string;
  message: string;
  type?: ToastType;
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
}

export interface ToastContextValue {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  showActionToast: (options: Omit<ToastMessage, 'id'>) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
  vault: (message: string) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export interface ToastProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

const TYPE_CONFIG: Record<ToastType, { icon: LucideIcon; iconColor: string; ringColor: string }> = {
  success: {
    icon: CheckCircle2,
    iconColor: 'text-emerald-400',
    ringColor: 'ring-emerald-500/20',
  },
  error: {
    icon: AlertCircle,
    iconColor: 'text-rose-400',
    ringColor: 'ring-rose-500/20',
  },
  warning: {
    icon: AlertTriangle,
    iconColor: 'text-amber-400',
    ringColor: 'ring-amber-500/20',
  },
  info: {
    icon: Info,
    iconColor: 'text-blue-400',
    ringColor: 'ring-blue-500/20',
  },
  vault: {
    icon: Lock,
    iconColor: 'text-amber-300',
    ringColor: 'ring-amber-400/25',
  },
};

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const { id, message, type = 'info', actionLabel, onAction } = toast;
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.info;
  const Icon = config.icon;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-black/90 dark:bg-zinc-900/95 text-white backdrop-blur-2xl border border-white/10 shadow-[0_10px_35px_-5px_rgba(0,0,0,0.5)] transition-all duration-300 transform animate-in fade-in slide-in-from-top-3 max-w-[92vw] select-none"
    >
      {/* Icon with glowing ring */}
      <div className={`p-1 rounded-full bg-white/10 ${config.ringColor} ring-1 flex-shrink-0`}>
        <Icon className={`w-3.5 h-3.5 stroke-[2.4] ${config.iconColor}`} />
      </div>

      {/* Message Text */}
      <p className="text-xs font-medium text-zinc-100 tracking-tight truncate max-w-[220px] sm:max-w-xs">
        {message}
      </p>

      {/* Optional Action Button */}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={() => {
            onAction();
            onDismiss(id);
          }}
          className="ml-1 px-2.5 py-0.5 rounded-full bg-white/20 hover:bg-white/30 text-white text-[11px] font-semibold transition-colors active:scale-95 flex-shrink-0"
        >
          {actionLabel}
        </button>
      )}

      {/* Quick Close Button */}
      <button
        type="button"
        onClick={() => onDismiss(id)}
        className="p-1 -mr-1 rounded-full text-zinc-400 hover:text-white transition-colors active:scale-95 flex-shrink-0"
        aria-label="Dismiss toast"
      >
        <X className="w-3.5 h-3.5 stroke-[2]" />
      </button>
    </div>
  );
};

export interface ToastProviderProps {
  children: React.ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showActionToast = useCallback(
    ({ message, type = 'info', duration = 3500, actionLabel, onAction }: Omit<ToastMessage, 'id'>) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newToast: ToastMessage = {
        id,
        message,
        type,
        duration,
        actionLabel,
        onAction,
      };

      setToasts((prev) => [...prev.slice(-2), newToast]); // Keep at most 3 active toasts

      if (duration > 0) {
        const timer = setTimeout(() => {
          dismissToast(id);
        }, duration);
        timersRef.current.set(id, timer);
      }
    },
    [dismissToast]
  );

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration: number = 3000) => {
      showActionToast({ message, type, duration });
    },
    [showActionToast]
  );

  const success = useCallback((msg: string) => showToast(msg, 'success'), [showToast]);
  const error = useCallback((msg: string) => showToast(msg, 'error', 4000), [showToast]);
  const info = useCallback((msg: string) => showToast(msg, 'info'), [showToast]);
  const warning = useCallback((msg: string) => showToast(msg, 'warning'), [showToast]);
  const vault = useCallback((msg: string) => showToast(msg, 'vault'), [showToast]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  return (
    <ToastContext.Provider
      value={{
        showToast,
        showActionToast,
        success,
        error,
        info,
        warning,
        vault,
        dismissToast,
      }}
    >
      {children}

      {/* Floating Dynamic Island Container */}
      <div
        aria-live="assertive"
        className="fixed top-[calc(var(--sat)+10px)] left-0 right-0 z-50 pointer-events-none flex flex-col items-center gap-2 px-4 transition-all duration-300"
      >
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
