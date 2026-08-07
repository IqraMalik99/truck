"use client";

import { useState } from "react";
import { Truck, User, Mail, Lock, Phone, IdCard, Building2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function SignUpPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    licenseNumber: "",
    carrierName: "",
  });
  const [status, setStatus] = useState("idle"); // idle | loading | error | success
  const [errorMsg, setErrorMsg] = useState("");

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.message || "Something went wrong. Try again.");
        return;
      } else {
        router.push("/sign-in");
      }

      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg("Could not reach the server. Check your connection.");
    }
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

      <div className="w-full max-w-[360px] relative">
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
              Driver Sign-Up
            </h1>
            <p className="text-neutral-500 text-xs mt-1 text-center">
              Log your trips, hours, and mileage
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <Field
              icon={User}
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Full name"
              required
            />

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
              placeholder="Password (min 8 characters)"
              required
            />

            <Field
              icon={Phone}
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              placeholder="Phone"
              required
            />

            <Field
              icon={IdCard}
              name="licenseNumber"
              value={form.licenseNumber}
              onChange={handleChange}
              placeholder="License number"
              required
            />

            <Field
              icon={Building2}
              name="carrierName"
              value={form.carrierName}
              onChange={handleChange}
              placeholder="Carrier name"
              required
            />

            {status === "error" && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {errorMsg}
              </p>
            )}

            {status === "success" && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                Account created. You can now sign in.
              </p>
            )}

            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-semibold rounded-xl py-2.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:ring-offset-2"
            >
              {status === "loading" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {status === "loading" ? "Creating account…" : "Create account"}
            </button>

            <p className="text-center text-xs text-neutral-500 pt-1">
              Already have an account?{" "}
              <a href="/sign-in" className="text-red-600 font-medium hover:underline">
                Sign in
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