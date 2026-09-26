import { Suspense } from "react";
import { RoutineView } from "@/components/RoutineView";

export default function EveningPage() {
  return (
    <Suspense>
      <RoutineView routine="evening" />
    </Suspense>
  );
}
