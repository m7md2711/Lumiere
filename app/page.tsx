import Link from "next/link";
import { Wordmark } from "@/components/Logo";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-6 py-16">
      <Wordmark sub="Patient Feedback System" />
      <div className="card p-6">
        <h1 className="text-xl font-semibold text-slate-900">Your experience matters</h1>
        <p className="mt-2 text-sm text-slate-600">
          Patients reach this system by scanning the QR code at their branch, or through
          the link the call centre sends them.
        </p>
      </div>
      <Link href="/start" className="btn btn-primary btn-lg">
        Share your experience
      </Link>
      <Link href="/admin" className="btn btn-ghost btn-lg">
        Staff sign in
      </Link>
    </main>
  );
}
