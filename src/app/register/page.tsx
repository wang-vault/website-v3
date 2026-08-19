import type { Metadata } from "next";
import { RegisterPage } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Daftar", robots: { index: false, follow: false } };

export default function Page() {
  return <RegisterPage />;
}
