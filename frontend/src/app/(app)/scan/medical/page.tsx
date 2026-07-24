import { redirect } from "next/navigation";

// The real backend-backed medical flow lives at /scan. This deep-links to it.
export default function ScanMedicalRedirect() {
  redirect("/scan?mode=medical");
}
