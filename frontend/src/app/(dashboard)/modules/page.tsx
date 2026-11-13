"use client";

import { ResourcePage } from "@/components/resource/resource-page";
import { modules } from "@/config/resources";

export default function Page() {
  return <ResourcePage config={modules} />;
}
