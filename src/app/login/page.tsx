import type { Metadata } from "next";
import { LoginPage } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Masuk", robots: { index: false, follow: false } };

export default function Page() {
  return <LoginPage />;
}
