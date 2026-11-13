"use client";

import { ResourcePage } from "@/components/resource/resource-page";
import { MEMBER_TYPES, teamMembers } from "@/config/resources";

// TM-03-03: filter by status and member type
export default function TeamMembersPage() {
  return (
    <ResourcePage
      config={teamMembers}
      tabs={[
        { value: "all", label: "All" },
        { value: "active", label: "Active", filter: (m) => m.status === "Active" },
        { value: "inactive", label: "Inactive", filter: (m) => m.status !== "Active" },
        ...MEMBER_TYPES.map((t) => ({ value: t, label: t, filter: (m: Record<string, unknown>) => m.member_type === t })),
      ]}
    />
  );
}
