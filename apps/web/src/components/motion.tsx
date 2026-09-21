import type { CSSProperties, ReactNode } from 'react';

/**
 * Sayfa girişi orkestrasyonu (docs/redesign/03-motion-system.md).
 * `<Enter i={n}>` bölgeyi n×55 ms gecikmeyle getirir. CSS animasyonu yalnız eleman DOM'a
 * girerken oynar: bölge sayfa bileşeniyle bir kez mount olur, sonraki veri güncellemelerinde
 * (state değişimi) yeniden oynamaz. Rota değişimi = yeniden mount = yeniden giriş (istenen).
 * Reduced motion CSS'te (yalnız 100 ms opaklık).
 */
export function Enter({
  i = 0,
  y,
  children,
  className = '',
  as: Tag = 'div',
}: {
  i?: number;
  y?: number;
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'header' | 'aside' | 'li';
}) {
  const style = { '--i': i, ...(y ? { '--enter-y': `${y}px` } : {}) } as CSSProperties;
  return (
    <Tag className={`region-enter ${className}`.trim()} style={style}>
      {children}
    </Tag>
  );
}

/** Ekran okuyucuya karar sonucu: görünmez, kibar (aria-live=polite). */
export function Live({ message }: { message: string | null }) {
  return (
    <div aria-live="polite" className="sr-only">
      {message}
    </div>
  );
}
