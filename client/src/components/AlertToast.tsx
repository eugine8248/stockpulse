import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useStore } from '../store';

/**
 * AlertToast — stacked top-right toasts for real-time price alerts.
 * Restyled as soft-bordered .surface cards with an accent ring on the side.
 * 8s auto-dismiss preserved from the original (alerts are noisy if persistent).
 */
export default function AlertToast() {
  const toasts = useStore((s) => s.alertToasts);
  const dismiss = useStore((s) => s.dismissAlertToast);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) => window.setTimeout(() => dismiss(t.id), 8000));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [toasts, dismiss]);

  return (
    <div className="fixed top-16 right-4 z-50 flex flex-col gap-2 w-80">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="surface shadow-md p-3 flex justify-between items-start gap-2 border-l-4 border-l-accent"
        >
          <div className="flex-1 min-w-0">
            <div className="text-xs text-accent font-mono font-semibold">{t.symbol} alert</div>
            <div className="text-sm text-text">{t.message}</div>
            <div className="text-[10px] text-text-muted mt-1 font-mono">
              {new Date(t.triggeredAt).toLocaleTimeString()}
            </div>
          </div>
          <button
            onClick={() => dismiss(t.id)}
            className="btn btn-ghost btn-icon btn-sm"
            aria-label="Dismiss alert"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
