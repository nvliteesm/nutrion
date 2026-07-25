"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthError, getStoredSession, register } from "@/lib/auth";
import { Button, Card } from "@/components/ui";
import { Field } from "@/components/auth/Field";
import { AuthDivider, GoogleButton } from "@/components/auth/GoogleButton";
import { AlertTriangleIcon } from "@/components/icons";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (getStoredSession()) router.replace("/today");
  }, [router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      await register({ fullName, email, password });
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
        Create your account
      </h1>
      <p className="mt-1 text-[13px] font-medium text-ink-2">
        Start with the Free plan — no card required.
      </p>

      <div className="mt-5 flex flex-col gap-4">
        <GoogleButton label="Sign up with Google" onError={setError} />
        <AuthDivider label="or sign up with email" />
      </div>

      <form onSubmit={handleSubmit} className="mt-1 flex flex-col gap-4">
        <Field
          label="Full name"
          name="fullName"
          type="text"
          autoComplete="name"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
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
          autoComplete="new-password"
          required
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Field
          label="Confirm password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />

        {error && (
          <div className="flex items-start gap-2 rounded-card-sm bg-red-t px-3 py-2.5 text-[12px] font-semibold text-red-d">
            <AlertTriangleIcon size={15} className="mt-px shrink-0" />
            {error}
          </div>
        )}

        <Button type="submit" size="lg" fullWidth disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="mt-5 text-center text-[13px] font-medium text-ink-2">
        Already have an account?{" "}
        <Link href="/login" className="font-bold text-teal-d">
          Log in
        </Link>
      </p>
    </Card>
  );
}
