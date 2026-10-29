export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Chargement" className="animate-pulse">
      <div className="h-8 w-64 rounded-lg bg-surface-3" />
      <div className="mt-3 h-4 w-96 max-w-full rounded bg-surface-3" />
      <div className="mt-8 grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 rounded-2xl bg-surface-3" />)}
      </div>
      <div className="mt-6 h-72 rounded-2xl bg-surface-3" />
    </div>
  );
}
