"use client";

import { ResourcePage } from "@/components/resource/resource-page";
import { journalEntries } from "@/config/resources";

export default function Page() {
  return <ResourcePage config={journalEntries} />;
}
