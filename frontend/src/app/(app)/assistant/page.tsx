import { redirect } from "next/navigation";

/** Legacy route — AI chat now lives at /history (nav: AI Chat). */
export default function AssistantPage() {
  redirect("/history");
}
