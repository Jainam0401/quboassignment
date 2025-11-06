"use client";
import React from "react";

const Page = () => {

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) =>  {
            e.preventDefault();
            const form = e.currentTarget as HTMLFormElement;
            const fd = new FormData(form);
            const email = (fd.get("email") ?? "").toString();
            const password = (fd.get("password") ?? "").toString();

            const mod = await import("zod");
            const z = mod.z;

            const schema = z.object({
              email: z.string().email("Enter a valid email address"),
              password: z
                .string()
                .min(6, "Password must be at least 6 characters"),
            });

            const result = schema.safeParse({ email, password });
            const errorsEl = document.getElementById("form-errors");

            
            if (!result.success) {
              const flat = result.error.flatten();
              const msgs = [
                ...(flat.formErrors ?? []),
                ...Object.values(flat.fieldErrors).flatMap((arr) => arr ?? []),
              ];
              if (errorsEl) errorsEl.textContent = msgs.join("\n");
              return;
            }

            if (errorsEl) errorsEl.textContent = "";
            alert("✅ Validated — submitting (mock)");
            form.reset();
          }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h2 className="mb-6 text-center text-2xl font-semibold text-gray-800">
          Sign in to your account
        </h2>

        <form
          className="space-y-5"
        onSubmit={handleSubmit}
        >
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>

          <div
            id="form-errors"
            className="whitespace-pre-wrap text-sm text-red-600"
          />

          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          >
            Sign in
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Don’t have an account?{" "}
          <a href="#" className="text-blue-600 hover:underline">
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
};

export default Page;
