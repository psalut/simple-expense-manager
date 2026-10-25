export type CategorySuggestionOption = {
  key: string;
  id: string;
  name: string;
  description: string;
};

export type CategoryView = {
  id: string;
  name: string;
  description: string;
  color: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
};
