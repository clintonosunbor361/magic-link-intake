export function Wordmark({ center = false }: { center?: boolean }) {
  return (
    <div className={center ? "text-center" : undefined}>
      <p className="text-lg font-extrabold text-kuartz-navy">Kuartz by Roti</p>
      <div className={`mt-3 h-1 w-12 rounded-full bg-kuartz-lime ${center ? "mx-auto" : ""}`} />
    </div>
  );
}