"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button, Input, Label } from "@/components/ui/primitives";

function LoginContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const [error, setError] = useState<string | null>(errorParam);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (session) {
      router.push("/admin");
    }
  }, [session, router]);

  async function onCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/admin",
    });
    setSubmitting(false);
    if (res?.error) {
      setError("Invalid email or password");
      return;
    }
    if (res?.ok) router.push("/admin");
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-[#6B7280]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-[#D9DFDA] bg-white p-8 shadow-sm">
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="t-page-title">Admin Console</h1>
            <p className="mt-2 t-helper">FHCHC Belonging Index Survey</p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-6 rounded-xl bg-[#FEE2E2] px-4 py-3 text-sm text-[#991B1B]">
              {error === "OAuthSignin" && "Error starting sign in process."}
              {error === "OAuthCallback" && "Error during sign in callback."}
              {error === "OAuthAccountNotLinked" &&
                "This email is already associated with another account."}
              {error === "CredentialsSignin" && "Invalid email or password."}
              {!["OAuthSignin", "OAuthCallback", "OAuthAccountNotLinked", "CredentialsSignin"].includes(error) &&
                error}
            </div>
          )}

          {/* Email/password form */}
          <form onSubmit={onCredentialsSubmit} className="space-y-4">
            <Label label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </Label>
            <Label label="Password">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </Label>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={submitting}
              className="w-full"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#E8ECE8]" />
            <span className="text-xs uppercase tracking-wider text-[#6B7280]">or</span>
            <div className="h-px flex-1 bg-[#E8ECE8]" />
          </div>

          {/* Google sign in */}
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => signIn("google", { callbackUrl: "/admin" })}
            className="w-full"
            leftIcon={
              <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            }
          >
            Continue with Google
          </Button>

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-[#6B7280]">
            Access restricted to authorized administrators
          </p>
        </div>
      </div>
    </div>
  );
}

function LoginFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-[#6B7280]">Loading...</div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </Suspense>
  );
}
