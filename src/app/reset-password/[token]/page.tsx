import type { Metadata } from "next";
import { ResetPasswordPage } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Atur Ulang Kata Sandi", robots: { index: false, follow: false } };

export default function Page({ params }: { params: { token: string } }) {
  return <ResetPasswordPage token={params.token} />;
}
