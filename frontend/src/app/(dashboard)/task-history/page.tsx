"use client";

import { ResourcePage } from "@/components/resource/resource-page";
import { taskHistory } from "@/config/resources";

export default function Page() {
  return <ResourcePage config={taskHistory} />;
}
