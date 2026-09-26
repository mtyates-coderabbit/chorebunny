import { Suspense } from "react";
import { RoutineView } from "@/components/RoutineView";

export default function MorningPage() {
  return (
    <Suspense>
      <RoutineView routine="morning" />
    </Suspense>
  );
}
