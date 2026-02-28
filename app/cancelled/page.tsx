import Link from "next/link";

export default function CancelledPage() {
  return (
    <div className="app-container max-w-md py-16 text-center">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[color:var(--accentSoft)]"><span className="text-4xl">❌</span></div>
      <h2 className="headline-lg mb-3">Payment Not Completed</h2>
      <p className="mb-8">No payment was processed. Any held spots will be released shortly.</p>
      <div className="space-y-3">
        <Link href="/" className="btn btn-primary w-full py-3">Try Again</Link>
      </div>
    </div>
  );
}
