import { PagePlaceholder } from "@/components/layout/PagePlaceholder";
import { LogoutButton } from "@/components/auth/LogoutButton";

export default function ProfilePage() {
  return (
    <div className="flex flex-col gap-4">
      <PagePlaceholder
        title="Profile"
        phase="Phase 12 (stretch)"
        description="Personal info, nutrition targets, dietary preferences, subscription, notifications and privacy settings."
      />
      <LogoutButton />
    </div>
  );
}
