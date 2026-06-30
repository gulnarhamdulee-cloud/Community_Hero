import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { collection, addDoc, doc, updateDoc, onSnapshot, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { useAuth } from '../auth/useAuth';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'achievement' | 'alert';
  read: boolean;
  createdAt: string;
}

export interface ToastItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'achievement' | 'alert';
}

interface NotificationContextProps {
  notifications: Notification[];
  unreadCount: number;
  toasts: ToastItem[];
  addNotification: (userId: string, title: string, message: string, type: Notification['type']) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismissToast: (toastId: string) => void;
  loading: boolean;
}

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);

  // Expose toast dismissed logic
  const dismissToast = (toastId: string) => {
    setToasts(prev => prev.filter(t => t.id !== toastId));
  };

  // Helper to add the notification to Firestore
  const addNotification = async (
    userId: string,
    title: string,
    message: string,
    type: Notification['type']
  ) => {
    try {
      const newNotif = {
        userId,
        title,
        message,
        type,
        read: false,
        createdAt: new Date().toISOString()
      };
      try {
        await addDoc(collection(db, 'notifications'), newNotif);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'notifications');
      }
    } catch (e) {
      console.warn("Could not save notification to Firestore, displaying locally:", e);
      // Fallback local-only toast if firestore fails
      const toastId = Date.now().toString();
      setToasts(prev => [...prev, { id: toastId, title, message, type }]);
    }
  };

  // Mark specific notification as read in Firestore
  const markAsRead = async (notificationId: string) => {
    try {
      const docRef = doc(db, 'notifications', notificationId);
      await updateDoc(docRef, { read: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `notifications/${notificationId}`);
    }
  };

  // Mark all notifications for the active user as read
  const markAllAsRead = async () => {
    if (!user) return;
    try {
      const unreadNotifs = notifications.filter(n => !n.read);
      await Promise.all(
        unreadNotifs.map(async (n) => {
          try {
            await updateDoc(doc(db, 'notifications', n.id), { read: true });
          } catch (e) {
            handleFirestoreError(e, OperationType.UPDATE, `notifications/${n.id}`);
          }
        })
      );
    } catch (e) {
      console.error("Failed to mark all as read:", e);
    }
  };

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      setHasLoadedInitial(false);
      return;
    }

    setLoading(true);

    // Filter by authenticated user's uid to keep data isolated (PII Pillar compliant)
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Notification[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Notification);
      });

      // Sort in-memory to prevent manual Firebase index creation blocker
      const sortedList = list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Trigger toasts only for newly arriving unread notifications after initial load
      if (hasLoadedInitial) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data() as Omit<Notification, 'id'>;
            if (!data.read && data.userId === user.uid) {
              const toastId = change.doc.id;
              setToasts(prev => {
                // Prevent duplicate toast triggers
                if (prev.some(t => t.id === toastId)) return prev;
                return [...prev, { id: toastId, title: data.title, message: data.message, type: data.type }];
              });

              // Self-dismiss after 6 seconds
              setTimeout(() => {
                dismissToast(toastId);
              }, 6000);
            }
          }
        });
      }

      setNotifications(sortedList);
      setHasLoadedInitial(true);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    });

    return () => unsubscribe();
  }, [user, hasLoadedInitial]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        toasts,
        addNotification,
        markAsRead,
        markAllAsRead,
        dismissToast,
        loading
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
