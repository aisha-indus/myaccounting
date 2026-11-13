"use client";

import { ResourcePage } from "@/components/resource/resource-page";
import { users } from "@/config/resources";

export default function Page() {
  return <ResourcePage config={users} />;
}
