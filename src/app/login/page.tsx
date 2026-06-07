import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginPageClient } from "../_components/LoginPageClient";

export const metadata: Metadata = {
  title: "Sign in — BookVerse",
};

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageClient />
    </Suspense>
  );
}
