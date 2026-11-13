"use client";

import { ResourcePage } from "@/components/resource/resource-page";
import { skills } from "@/config/resources";

export default function Page() {
  return <ResourcePage config={skills} />;
}
