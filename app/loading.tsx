export default function RootLoading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 text-gray-100 font-syne">
      <div
        className="w-12 h-12 rounded-full border-4 border-gray-700 border-t-[var(--agora-accent-blue)] animate-spin"
        aria-hidden
      />
      <p className="mt-4 text-gray-400 text-sm font-medium animate-pulse">
        Loading…
      </p>
    </div>
  );
}
