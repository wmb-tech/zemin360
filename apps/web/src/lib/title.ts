import { useEffect } from 'react';

/** Sekme başlığı: "Sayfa · Evidex". Her sayfa kendi adını verir. */
export function useTitle(t: string) {
  useEffect(() => {
    document.title = `${t} · Evidex`;
    return () => {
      document.title = 'Evidex';
    };
  }, [t]);
}
