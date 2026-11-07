import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

/**
 * OfflineIndicator: Notificación visual no invasiva cuando se pierde la conexión a internet.
 */
export const OfflineIndicator = () => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-destructive text-destructive-foreground px-4 py-2.5 rounded-lg shadow-lg text-xs font-medium animate-bounce"
    >
      <WifiOff className="h-4 w-4" />
      <span>Sin conexión a internet. Operando en modo local.</span>
    </div>
  );
};
