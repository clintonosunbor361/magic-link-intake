export default function CrmLoading() {
  return (
    <div aria-label="Loading workspace" role="status">
      <div className="h-3 w-28 animate-pulse rounded bg-[#deddd6]" />
      <div className="mt-5 h-12 w-full max-w-xl animate-pulse rounded bg-[#deddd6]" />
      <div className="mt-4 h-4 w-full max-w-md animate-pulse rounded bg-[#e7e6df]" />
      <div className="mt-12 grid gap-5 md:grid-cols-[1.35fr_.65fr]">
        <div className="h-52 animate-pulse rounded bg-[#e7e6df]" />
        <div className="h-52 animate-pulse rounded bg-[#e7e6df]" />
      </div>
    </div>
  );
}
