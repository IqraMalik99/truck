"use client";

import { useState } from "react";
import { Truck, Mail, Lock, Loader2 } from "lucide-react";
import { signIn, getSession } from "next-auth/react";

export default function SignInPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [status, setStatus] = useState("idle"); // idle | loading | error
  const [errorMsg, setErrorMsg] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    const res = await signIn("credentials", {
      redirect: false,
      email: form.email,
      password: form.password,
    });


    if (res?.error) {
      setStatus("error");
      setErrorMsg(
        res.error === "CredentialsSignin"
          ? "Incorrect email or password."
          : res.error
      );
      return;
    }

    const session = await getSession();

    if (session?.user?.role === "admin") {
      window.location.href = "/admin";
    } else {
      window.location.href = "/dashboard";
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    await signIn("google", {
      callbackUrl: "/auth/redirect",
    });
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4 py-12 relative overflow-hidden bg-white">
      {/* Soft color blobs — the glass card blurs against these */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-16 w-72 h-72 rounded-full opacity-60 blur-3xl"
        style={{ background: "#fecaca" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -right-16 w-72 h-72 rounded-full opacity-50 blur-3xl"
        style={{ background: "#fee2e2" }}
      />

      <div className="w-full max-w-[340px] relative">
        {/* Glass card */}
        <div
          className="rounded-2xl px-7 py-8 border border-black/5"
          style={{
            background: "rgba(255,255,255,0.55)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.06)",
          }}
        >
          {/* Header */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-15 h-15 rounded-4xl bg-red-600 flex items-center justify-center mb-3">
              <Truck className="w-8 h-8 text-white" strokeWidth={2} />
            </div>
            <h1 className="text-lg font-semibold tracking-tight text-neutral-900">
              Driver Sign-In
            </h1>
            <p className="text-neutral-500 text-xs mt-1 text-center">
              View your trips and daily hours
            </p>
          </div>

          {/* Google sign-in */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-2.5 border border-black/10 hover:bg-black/[0.03] disabled:opacity-60 text-neutral-700 text-sm font-medium rounded-xl py-2.5 mb-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:ring-offset-2"
          >
            {googleLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            {googleLoading ? "Redirecting…" : "Continue with Google"}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1 bg-black/10" />
            <span className="text-[10px] text-neutral-400 font-medium tracking-wide">OR</span>
            <div className="h-px flex-1 bg-black/10" />
          </div>

          {/* Credentials form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <Field
              icon={Mail}
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="Email"
              required
            />

            <Field
              icon={Lock}
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Password"
              required
            />

            {status === "error" && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-semibold rounded-xl py-2.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:ring-offset-2"
            >
              {status === "loading" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {status === "loading" ? "Signing in…" : "Sign in"}
            </button>

            <p className="text-center text-xs text-neutral-500 pt-1">
              Don't have an account?{" "}
              <a href="/sign-up" className="text-red-600 font-medium hover:underline">
                Sign up
              </a>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({ icon: Icon, name, type = "text", value, onChange, placeholder, required }) {
  return (
    <div className="relative">
      <Icon className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-black/10 bg-white/70 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-red-400 focus:bg-white focus:ring-2 focus:ring-red-100 transition-colors"
      />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47c-.28 1.48-1.13 2.74-2.4 3.58v2.98h3.89c2.28-2.1 3.56-5.2 3.56-8.75z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.89-2.98c-1.08.73-2.46 1.16-4.06 1.16-3.12 0-5.77-2.11-6.72-4.94H1.27v3.07C3.25 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.28 14.34A7.2 7.2 0 0 1 4.9 12c0-.81.14-1.6.38-2.34V6.59H1.27A11.99 11.99 0 0 0 0 12c0 1.93.46 3.76 1.27 5.41l4-3.07z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.27 6.59l4 3.07C6.23 6.86 8.88 4.75 12 4.75z" />
    </svg>
  );
}