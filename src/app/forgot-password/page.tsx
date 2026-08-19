import type { Metadata } from "next";
import { ForgotPasswordPage } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Lupa Kata Sandi", robots: { index: false, follow: false } };

export default function Page() {
  return <ForgotPasswordPage />;
}
