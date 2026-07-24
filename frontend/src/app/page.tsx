import { redirect } from "next/navigation";

export default function RootPage() {
  // Phase 1 will introduce auth; for now the app opens straight on Today.
  redirect("/today");
}
