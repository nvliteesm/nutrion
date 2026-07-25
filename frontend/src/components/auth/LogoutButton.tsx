"use client";

import { useRouter } from "next/navigation";
import { logout } from "@/lib/auth";
import { Button } from "@/components/ui";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <Button variant="outline" onClick={handleLogout}>
      Log out
    </Button>
  );
}
