import type { Metadata } from "next";
import { LegalPage, legalMetadata } from "@/components/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  return legalMetadata("refund");
}

export default function Page() {
  return <LegalPage slug="refund" />;
}
