import { memo } from 'react';
import { Bell, CheckCheck, Award, AlertCircle, Info, CheckCircle2, Circle } from 'lucide-react';
import { useNotifications, Notification } from '../../features/notifications/NotificationProvider';

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

function NotificationPanel({ isOpen, onClose }: NotificationPanelProps) {
  const { notifications, unreadCount, markAsRead, markAllAsRead, loading } = useNotifications();

  if (!isOpen) return null;

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />;
      case 'achievement':
        return <Award className="w-4 h-4 text-amber-500 shrink-0" />;
      case 'alert':
        return <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />;
      case 'info':
      default:
        return <Info className="w-4 h-4 text-navy shrink-0" />;
    }
  };

  return (
    <>
      {/* Background click listener overlay */}
      <div className="fixed inset-0 z-[1998]" onClick={onClose} />

      {/* Floating Panel Panel Card */}
      <div className="absolute right-0 top-12 w-80 md:w-96 bg-white border border-slate-205 shadow-2xl rounded-2xl z-[1999] flex flex-col max-h-[480px] font-sans animate-fade-in divide-y divide-slate-100 overflow-hidden">
        
        {/* Header summary actions */}
        <div className="px-4 py-3 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-1.5">
            <Bell className="w-4 h-4 text-navy" />
            <span className="text-xs font-bold text-navy uppercase tracking-wider">Civic Notifications</span>
            {unreadCount > 0 && (
              <span className="bg-rose-500 text-white text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={() => {
                markAllAsRead();
              }}
              className="text-[10px] font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 hover:underline cursor-pointer"
              title="Mark all notifications as read"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all read</span>
            </button>
          )}
        </div>

        {/* Scrollable feed content wrapper */}
        <div data-lenis-prevent className="overflow-y-auto flex-1 divide-y divide-slate-100 scrollbar-thin">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400 font-mono">
              Loading alerts...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
                <Bell className="w-5 h-5 text-slate-400" />
              </div>
              <h5 className="text-xs font-bold text-slate-700">No Notifications</h5>
              <p className="text-[10px] text-slate-400">You are all caught up on civic updates!</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => {
                  if (!notif.read) markAsRead(notif.id);
                }}
                className={`p-3.5 flex gap-3 cursor-pointer transition-colors hover:bg-slate-50/70 items-start relative ${
                  !notif.read ? 'bg-amber-50/25' : ''
                }`}
              >
                {/* Visual Unread highlight bar */}
                {!notif.read && (
                  <span className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500" />
                )}

                <div className="mt-0.5">
                  {getIcon(notif.type)}
                </div>

                <div className="flex-1 space-y-0.5 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h6 className={`text-[11px] leading-tight truncate ${!notif.read ? 'font-bold text-slate-900' : 'font-semibold text-slate-600'}`}>
                      {notif.title}
                    </h6>
                    {!notif.read && (
                      <Circle className="w-2 h-2 text-amber-500 fill-amber-500 shrink-0 mt-0.5" />
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 leading-snug break-words">
                    {notif.message}
                  </p>
                  <span className="block text-[8px] text-slate-400 font-mono font-medium pt-1">
                    {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(notif.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info dismiss */}
        <div className="px-4 py-2 bg-slate-50 text-center">
          <button
            onClick={onClose}
            className="text-[10px] font-bold text-slate-500 hover:text-slate-700 font-mono leading-none py-1 block w-full text-center"
          >
            Close Feed
          </button>
        </div>

      </div>
    </>
  );
}

export default memo(NotificationPanel);
