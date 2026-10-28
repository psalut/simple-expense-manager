export type MovementDraft = {
  kind: "expense" | "income";
  amount: string;
  description: string;
  date: string;
  categoryId: string;
  shared: boolean;
  groupId: string;
};

export function switchMovementDraft(
  draft: MovementDraft,
  nextKind: MovementDraft["kind"],
): MovementDraft {
  return {
    ...draft,
    kind: nextKind,
    categoryId: "",
    shared: false,
    groupId: "",
  };
}
