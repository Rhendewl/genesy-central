import type { Metadata } from "next";
import { SignaturePage } from "./signature-page";
export const metadata: Metadata = {
  title: "Assinar contrato",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function Page({ params }: { params: { token: string } }) {
  return <SignaturePage token={params.token} />;
}
