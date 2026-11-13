"use client";

import { ResourcePage } from "@/components/resource/resource-page";
import { roles } from "@/config/resources";

export default function Page() {
  return <ResourcePage config={roles} />;
}
