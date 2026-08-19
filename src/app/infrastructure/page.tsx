import type { Metadata } from "next";
import { CmsPage, cmsPageMetadata } from "@/components/cms-page";

export async function generateMetadata(): Promise<Metadata> {
  return cmsPageMetadata("infrastructure");
}

export default function Page() {
  return <CmsPage slug="infrastructure" />;
}
