import { useState } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '../../features/notifications/NotificationProvider';
import NotificationPanel from './NotificationPanel';

export default function NotificationBell() {
  const { unreadCount } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 bg-slate-50 border border-slate-100 hover:bg-slate-100 rounded-xl text-navy transition-all duration-200 cursor-pointer flex items-center justify-center relative focus:outline-none"
        title="View Civic Alerts feed"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white font-mono font-black text-[9px] w-5 h-5 rounded-full flex items-center justify-center shadow-md animate-bounce">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Floating panel of notifications */}
      <NotificationPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </div>
  );
}
