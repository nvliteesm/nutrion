"use client";

import { useRouter } from "next/navigation";
import { clearSession } from "@/lib/auth";
import { Button } from "@/components/ui";

export function LogoutButton() {
  const router = useRouter();

  function handleLogout() {
    clearSession();
    router.replace("/login");
  }

  return (
    <Button variant="outline" onClick={handleLogout}>
      Log out
    </Button>
  );
}
