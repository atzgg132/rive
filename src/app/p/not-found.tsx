import Link from "next/link";

export default function PublicPortfolioNotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-6 py-16 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="max-w-md text-center">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Rive portfolio</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight">This portfolio is not available.</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
          The link may be incorrect, or the owner may not have published this portfolio yet.
        </p>
        <Link href="/" className="mt-7 inline-flex rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">
          Visit Rive
        </Link>
      </div>
    </main>
  );
}
