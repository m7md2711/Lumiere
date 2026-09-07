import Link from "next/link";
import { Wordmark } from "@/components/Logo";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-6 py-16">
      <Wordmark sub="Patient Feedback System" />
      <div className="card p-6">
        <h1 className="text-xl font-semibold text-slate-900">Your experience matters</h1>
        <p className="mt-2 text-sm text-slate-600">
          Patients reach this system by scanning the QR code displayed at their branch.
          Each code carries its own branch and location.
        </p>
      </div>
      <Link href="/admin" className="btn btn-primary btn-lg">
        Staff sign in
      </Link>
    </main>
  );
}
