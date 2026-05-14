import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useStore } from '../store';

export default function AlertToast() {
  const toasts = useStore((s) => s.alertToasts);
  const dismiss = useStore((s) => s.dismissAlertToast);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) =>
      window.setTimeout(() => dismiss(t.id), 8000)
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [toasts, dismiss]);

  return (
    <div className="fixed top-16 right-4 z-50 flex flex-col gap-2 w-80">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="bg-elevated border border-accent/40 rounded-lg p-3 shadow-lg flex justify-between items-start gap-2"
        >
          <div className="flex-1 min-w-0">
            <div className="text-xs text-accent font-mono font-semibold">
              {t.symbol} alert
            </div>
            <div className="text-sm text-text">{t.message}</div>
            <div className="text-[10px] text-textFaint mt-1">
              {new Date(t.triggeredAt).toLocaleTimeString()}
            </div>
          </div>
          <button onClick={() => dismiss(t.id)} className="text-textFaint hover:text-text">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
