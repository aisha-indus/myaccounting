"use client";

import { ResourcePage } from "@/components/resource/resource-page";
import { businesses } from "@/config/resources";

export default function Page() {
  return <ResourcePage config={businesses} />;
}
