import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { Badge } from '@/components/ui';

export function OfflineBadge() {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const marcarOnline = () => setOnline(true);
    const marcarOffline = () => setOnline(false);
    window.addEventListener('online', marcarOnline);
    window.addEventListener('offline', marcarOffline);
    return () => {
      window.removeEventListener('online', marcarOnline);
      window.removeEventListener('offline', marcarOffline);
    };
  }, []);

  if (online) return null;

  return (
    <Badge variant="outline" className="gap-1 text-[10px]">
      <WifiOff className="h-3 w-3" />
      Sin conexión · datos cacheados
    </Badge>
  );
}
