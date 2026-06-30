import { Info, CheckCircle2, AlertCircle, Award, X } from 'lucide-react';
import { useNotifications, ToastItem } from '../../features/notifications/NotificationProvider';

export default function NotificationToast() {
  const { toasts, dismissToast } = useNotifications();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 z-[9999] flex flex-col gap-3 w-80 max-w-[92%] pointer-events-none">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void; key?: string }) {
  // Styles based on notification levels
  const getStyle = (type: ToastItem['type']) => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-emerald-50 border-emerald-100 text-emerald-800',
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />,
          bar: 'bg-emerald-500'
        };
      case 'achievement':
        return {
          bg: 'bg-amber-50 border-amber-100 text-amber-900',
          icon: <Award className="w-5 h-5 text-amber-600 shrink-0" />,
          bar: 'bg-amber-500 font-extrabold'
        };
      case 'alert':
        return {
          bg: 'bg-rose-50 border-rose-100 text-rose-800',
          icon: <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />,
          bar: 'bg-rose-600'
        };
      case 'info':
      default:
        return {
          bg: 'bg-slate-50 border-slate-100 text-slate-800',
          icon: <Info className="w-5 h-5 text-navy shrink-0" />,
          bar: 'bg-navy'
        };
    }
  };

  const style = getStyle(toast.type);

  return (
    <div 
      className={`pointer-events-auto flex gap-3 p-4 rounded-xl border shadow-xl relative overflow-hidden animate-slide-in justify-between items-start transition-all ${style.bg}`}
      id={`toast-${toast.id}`}
    >
      {/* Visual slide time countdown bar */}
      <span className={`absolute bottom-0 left-0 h-1 w-full shrink-0 ${style.bar} animate-toast-shrink`} />

      <div className="flex gap-2.5 items-start">
        {style.icon}
        <div className="space-y-0.5">
          <h5 className="text-xs font-bold font-sans tracking-tight">{toast.title}</h5>
          <p className="text-[11px] font-sans opacity-90 leading-normal font-medium">{toast.message}</p>
        </div>
      </div>

      <button
        onClick={() => onDismiss(toast.id)}
        className="p-1 hover:bg-black/5 rounded text-slate-400 hover:text-slate-600 cursor-pointer self-start"
        title="Dismiss Toast"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
