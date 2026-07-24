import { redirect } from "next/navigation";

// The real backend-backed scan flow lives at /scan. This deep-links to it.
export default function ScanFoodRedirect() {
  redirect("/scan?mode=food");
}
