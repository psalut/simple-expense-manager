import type { CategoryView } from "@/lib/categories/types";
import type { ExpenseGroupOption } from "@/components/expenses/expense-editor-dialog";
import type {
  GroupBalanceView,
  GroupExpenseView,
  PersonalExpenseView,
} from "@/lib/server/expenses";
import type { PersonalIncomeView } from "@/lib/server/incomes";
import type { SharedSpaceOverview } from "@/lib/shared-spaces/types";

export type CategoryTransport = Omit<CategoryView, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

export type ExpensePageData = {
  expenses: PersonalExpenseView[];
  incomes: PersonalIncomeView[];
  monthlyTotal: string;
  categories: CategoryView[];
  groups: ExpenseGroupOption[];
};

export type ExpensePageTransport = Omit<ExpensePageData, "categories"> & {
  categories: CategoryTransport[];
};

export type HouseholdPageData = {
  household: { empty: boolean; canJoin: boolean };
  space: SharedSpaceOverview | null;
  legacy: SharedSpaceOverview[];
  overview: { expenses: GroupExpenseView[]; balances: GroupBalanceView[] } | null;
  categories: CategoryView[];
};

export type HouseholdPageTransport = Omit<HouseholdPageData, "categories"> & {
  categories: CategoryTransport[];
};
