"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthError, getStoredSession, login } from "@/lib/auth";
import { Button, Card } from "@/components/ui";
import { Field } from "@/components/auth/Field";
import { AlertTriangleIcon } from "@/components/icons";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("maya@example.com");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in? Skip straight to the app.
  useEffect(() => {
    if (getStoredSession()) router.replace("/today");
  }, [router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.replace("/today");
    } catch (err) {
      setError(
        err instanceof AuthError ? err.message : "Something went wrong. Try again.",
      );
      setSubmitting(false);
    }
  }

  return (
    <Card className="p-7">
      <h1 className="text-[22px] font-extrabold tracking-tight text-ink">
        Welcome back
      </h1>
      <p className="mt-1 text-[13px] font-medium text-ink-2">
        Log in to keep tracking your nutrition.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && (
          <div className="flex items-start gap-2 rounded-card-sm bg-red-t px-3 py-2.5 text-[12px] font-semibold text-red-d">
            <AlertTriangleIcon size={15} className="mt-px shrink-0" />
            {error}
          </div>
        )}

        <Button type="submit" size="lg" fullWidth disabled={submitting}>
          {submitting ? "Logging in…" : "Log in"}
        </Button>
      </form>

      <p className="mt-5 text-center text-[13px] font-medium text-ink-2">
        New to NutriON?{" "}
        <Link href="/register" className="font-bold text-teal-d">
          Create an account
        </Link>
      </p>

      <div className="mt-5 rounded-card-sm bg-app-bg px-3.5 py-3 text-[11.5px] leading-relaxed text-ink-2">
        <span className="font-bold text-ink">Demo accounts</span>
        <br />
        Premium: maya@example.com · Free: alex@example.com
        <br />
        Password: demo1234
      </div>
    </Card>
  );
}
