export type SharedSpaceOverview = {
  id: string;
  name: string;
  members: { userId: string; name: string }[];
};
