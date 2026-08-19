import type { Metadata } from "next";
import { VerifyEmailClient } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Verifikasi Email", robots: { index: false, follow: false } };

export default function Page({ params }: { params: { token: string } }) {
  return <VerifyEmailClient token={params.token} />;
}
