import { redirect } from "next/navigation";

export default function RootPage() {
  // Middleware also handles `/`; this is a safe fallback.
  redirect("/login");
}
