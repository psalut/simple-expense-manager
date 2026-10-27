import { HouseholdPageClient } from "@/components/groups/household-page-client";
import { currentDateInBuenosAires } from "@/lib/expenses/format";

export default function HouseholdPage() {
  return <HouseholdPageClient today={currentDateInBuenosAires()} />;
}
