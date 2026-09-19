/** İlk sürüm sayfaları: içerik döngü adımları geldikçe dolacak. */
export function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="text-ink-soft mt-2 max-w-prose">{note}</p>
    </div>
  );
}
