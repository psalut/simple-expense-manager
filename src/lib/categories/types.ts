import type { CategoryScope } from "@/lib/categories/policy";

export type CategoryView = {
  id: string;
  name: string;
  description: string;
  scope: CategoryScope;
  sharedSpaceId: string | null;
  sharedSpaceName: string | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
};
