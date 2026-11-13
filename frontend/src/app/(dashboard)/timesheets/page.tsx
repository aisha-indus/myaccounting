"use client";

import { ResourcePage } from "@/components/resource/resource-page";
import { timeSheet } from "@/config/resources";

export default function Page() {
  return <ResourcePage config={timeSheet} />;
}
