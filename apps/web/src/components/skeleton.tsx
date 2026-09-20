/** Yüklenirken boş ekran yerine iskelet: sayfa geldi, veri geliyor. */
export function Skeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="animate-pulse space-y-3" aria-busy="true" aria-label="Yükleniyor">
      <div className="bg-paper-2 h-7 w-48 rounded" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="bg-paper-2 h-4 rounded" style={{ width: `${88 - i * 9}%` }} />
      ))}
    </div>
  );
}
