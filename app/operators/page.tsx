import Link from "next/link";

const plans = [
  { name: "Starter", price: 1500, seats: 1, bookings: "100 paid bookings / month" },
  { name: "Growth", price: 3000, seats: 3, bookings: "500 paid bookings / month" },
  { name: "Pro", price: 6500, seats: 10, bookings: "Uncapped paid bookings (fair-use)" },
];

function zar(v: number) {
  return "R" + v.toLocaleString("en-ZA");
}

export default function OperatorsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-6 py-12 md:px-10">
      <div className="mx-auto max-w-6xl space-y-10">
        <header className="space-y-4 text-center">
          <p className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">CapeKayak SaaS</p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">All features from day one. Scale only when your bookings and team grow.</h1>
          <p className="mx-auto max-w-3xl text-base text-slate-600 md:text-lg">From inquiry to paid booking to operations in one system for activity operators.</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/case-study/cape-kayak" className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">Read the Cape Kayak case study</Link>
            <Link href="/compare/manual-vs-disconnected-tools" className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">See platform comparison</Link>
          </div>
        </header>

        <section className="grid gap-5 md:grid-cols-3">
          {plans.map((p) => (
            <div key={p.name} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">{p.name}</h2>
              <p className="mt-2 text-3xl font-bold text-slate-900">{zar(p.price)}<span className="text-sm font-medium text-slate-500">/month</span></p>
              <p className="mt-1 text-xs text-slate-500">Setup fee: {zar(3500)} once-off</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-700">
                <li>{p.seats} admin {p.seats === 1 ? "seat" : "seats"}</li>
                <li>{p.bookings}</li>
                <li>All core features included</li>
              </ul>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-lg font-semibold text-slate-900">Add-ons</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li>Landing page build: {zar(3500)} for the first page</li>
            <li>Additional landing pages: {zar(1500)} per page</li>
            <li>Landing page hosting: {zar(500)}/month per business</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-lg font-semibold text-slate-900">Top-up packs</h3>
          <p className="mt-2 text-sm text-slate-600">When you hit your monthly booking cap, keep selling with instant top-ups:</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"><p className="font-semibold text-slate-900">R100</p><p className="text-slate-600">+10 paid bookings</p></div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"><p className="font-semibold text-slate-900">R500</p><p className="text-slate-600">+60 paid bookings</p></div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"><p className="font-semibold text-slate-900">R1,000</p><p className="text-slate-600">+140 paid bookings</p></div>
          </div>
        </section>
      </div>
    </div>
  );
}
