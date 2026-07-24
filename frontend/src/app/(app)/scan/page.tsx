"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui";
import {
  ChevronRightIcon,
  CupIcon,
  FileTextIcon,
  InfoIcon,
  LockIcon,
  PlusIcon,
  SparkleIcon,
  UtensilsIcon,
} from "@/components/icons";
import { getStoredSession } from "@/lib/auth";
import type { Subscription } from "@/lib/types";

export default function ScanPage() {
  // Reflect the signed-in account so Free users see the Premium lock.
  const [subscription, setSubscription] = useState<Subscription>("free");
  useEffect(() => {
    const session = getStoredSession();
    if (session) setSubscription(session.subscription);
  }, []);

  const medicalLocked = subscription !== "premium";

  return (
    <div className="flex flex-col">
      <h1 className="text-[22px] font-extrabold tracking-tight text-ink md:text-[24px]">
        Log something
      </h1>
      <p className="mt-1.5 text-[13px] font-medium leading-relaxed text-ink-2 md:mb-1 md:text-[14px]">
        Pick how you&rsquo;d like to add an entry. You&rsquo;ll always review the
        numbers before anything is saved.
      </p>

      {/* Desktop: three primary cards */}
      <div className="mt-5 hidden gap-4 md:grid md:grid-cols-3">
        <PrimaryCard
          href="/scan/drink"
          icon={<CupIcon size={24} />}
          iconClass="bg-blue-t text-blue-d"
          title="Scan drink label"
          badge={{ label: "MOST RELIABLE", tone: "teal" }}
          description="Point at a nutrition-facts panel. We read the printed values, so results are accurate."
          action="Open camera"
        />
        <PrimaryCard
          href="/scan/food"
          icon={<UtensilsIcon size={24} />}
          iconClass="bg-teal-t text-teal-d"
          title="Scan food"
          badge={{ label: "ESTIMATE", tone: "amber" }}
          description="Snap a plate of food. We estimate items and portions — you'll see a range, then review."
          action="Open camera"
        />
        <PrimaryCard
          href="/scan/medical"
          icon={<FileTextIcon size={24} />}
          iconClass="bg-navy/[0.06] text-navy"
          title="Upload medical report"
          premium
          description="Add lab results (PDF or photo) for educational, nutrition-linked context. Confirmed by you."
          action={medicalLocked ? "Unlock with Premium" : "Upload report"}
          locked={medicalLocked}
        />
      </div>

      {/* Desktop: manual entry, full width */}
      <Link href="/scan/manual" className="mt-4 hidden md:block">
        <Card className="flex items-center gap-4 p-5 transition-shadow hover:shadow-card-lg">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-navy/[0.06] text-navy">
            <PlusIcon size={24} />
          </span>
          <div className="flex-1">
            <div className="text-[16px] font-bold text-ink">Enter manually</div>
            <p className="mt-0.5 text-[13px] font-medium text-ink-2">
              Type in food, a drink, or water yourself — with save-to-favorites
              for fast re-logging.
            </p>
          </div>
          <ChevronRightIcon size={20} className="text-ink-3" />
        </Card>
      </Link>

      {/* Mobile: list of rows */}
      <div className="mt-4 flex flex-col gap-3 md:hidden">
        <MobileRow
          href="/scan/drink"
          icon={<CupIcon size={22} />}
          iconClass="bg-blue-t text-blue-d"
          title="Scan drink label"
          badge={{ label: "RELIABLE", tone: "teal" }}
          subtitle="Reads printed values"
        />
        <MobileRow
          href="/scan/food"
          icon={<UtensilsIcon size={22} />}
          iconClass="bg-teal-t text-teal-d"
          title="Scan food"
          badge={{ label: "ESTIMATE", tone: "amber" }}
          subtitle="Estimated range, then review"
        />
        <MobileRow
          href="/scan/medical"
          icon={<FileTextIcon size={22} />}
          iconClass="bg-navy/[0.06] text-navy"
          title="Upload medical report"
          subtitle="Premium · educational context"
          locked={medicalLocked}
        />
        <MobileRow
          href="/scan/manual"
          icon={<PlusIcon size={22} />}
          iconClass="bg-navy/[0.06] text-navy"
          title="Enter manually"
          subtitle="Food, drink or water"
        />
      </div>

      {/* Info banner */}
      <div className="mt-5 flex items-start gap-2.5 rounded-card bg-blue-t px-4 py-3.5">
        <InfoIcon size={18} className="mt-px shrink-0 text-blue-d" />
        <p className="text-[11.5px] font-medium leading-relaxed text-blue-d md:text-[12.5px]">
          Label scans read printed values and are the most accurate. Food photos
          are estimates — always review and correct them before saving. NutriON
          provides nutrition tracking and educational information; it does not
          diagnose or replace professional healthcare advice.
        </p>
      </div>
    </div>
  );
}

type BadgeInfo = { label: string; tone: "teal" | "amber" };

function badgeClass(tone: BadgeInfo["tone"]): string {
  return tone === "teal" ? "bg-teal-t text-teal-d" : "bg-amber-t text-amber-d";
}

function PrimaryCard({
  href,
  icon,
  iconClass,
  title,
  badge,
  premium,
  description,
  action,
  locked,
}: {
  href: string;
  icon: React.ReactNode;
  iconClass: string;
  title: string;
  badge?: BadgeInfo;
  premium?: boolean;
  description: string;
  action: string;
  locked?: boolean;
}) {
  return (
    <Link href={href}>
      <Card className="relative flex h-full flex-col p-[22px] transition-shadow hover:shadow-card-lg">
        {premium && (
          <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-amber px-2 py-1 text-[9.5px] font-bold tracking-wide text-navy-ink">
            <SparkleIcon size={10} />
            PREMIUM
          </span>
        )}
        <span
          className={`mb-3.5 inline-flex h-12 w-12 items-center justify-center rounded-[14px] ${iconClass}`}
        >
          {icon}
        </span>
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-[16px] font-bold text-ink">{title}</span>
          {badge && (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-wide ${badgeClass(badge.tone)}`}
            >
              {badge.label}
            </span>
          )}
        </div>
        <p className="mb-4 text-[13px] font-medium leading-relaxed text-ink-2">
          {description}
        </p>
        <div
          className={`mt-auto flex items-center justify-center gap-1.5 rounded-[11px] py-2.5 text-[13px] font-bold ${
            locked
              ? "bg-navy/[0.06] text-ink-2"
              : "bg-navy text-white"
          }`}
        >
          {locked && <LockIcon size={14} />}
          {action}
        </div>
      </Card>
    </Link>
  );
}

function MobileRow({
  href,
  icon,
  iconClass,
  title,
  badge,
  subtitle,
  locked,
}: {
  href: string;
  icon: React.ReactNode;
  iconClass: string;
  title: string;
  badge?: BadgeInfo;
  subtitle: string;
  locked?: boolean;
}) {
  return (
    <Link href={href}>
      <Card className="flex items-center gap-3.5 p-4">
        <span
          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] ${iconClass}`}
        >
          {icon}
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[15px] font-bold text-ink">{title}</span>
            {badge && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold ${badgeClass(badge.tone)}`}
              >
                {badge.label}
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[11.5px] font-medium text-ink-2">
            {subtitle}
          </div>
        </div>
        {locked ? (
          <LockIcon size={16} className="text-amber-d" />
        ) : (
          <ChevronRightIcon size={18} className="text-ink-3" />
        )}
      </Card>
    </Link>
  );
}
