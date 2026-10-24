import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  delete: vi.fn(),
  getSharedSpaceIdsForUser: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({
  db: { select: mocks.select, delete: mocks.delete },
}));
vi.mock("@/lib/server/shared-spaces", () => ({
  getSharedSpaceIdsForUser: mocks.getSharedSpaceIdsForUser,
}));

import { categories } from "@/db/categories-schema";
import { CategoryError, deleteArchivedCategory } from "@/lib/server/categories";

const archivedPersonal = {
  id: "category-a",
  name: "Transporte",
  description: "Viajes",
  userId: "user-a",
  sharedSpaceId: null,
  isArchived: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function configureSelect(result: object[]) {
  const query = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
  };
  query.from.mockReturnValue(query);
  query.where.mockReturnValue(query);
  query.limit.mockResolvedValue(result);
  mocks.select.mockReturnValue(query);
  return query;
}

function configureDelete(result: object[]) {
  const query = {
    where: vi.fn(),
    returning: vi.fn(),
  };
  query.where.mockReturnValue(query);
  query.returning.mockResolvedValue(result);
  mocks.delete.mockReturnValue(query);
  return query;
}

describe("deleteArchivedCategory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSharedSpaceIdsForUser.mockResolvedValue([]);
  });

  it("deletes an archived personal category owned by the authenticated user", async () => {
    configureSelect([archivedPersonal]);
    const deleteQuery = configureDelete([{ id: archivedPersonal.id }]);

    await expect(
      deleteArchivedCategory("user-a", archivedPersonal.id),
    ).resolves.toEqual({ id: archivedPersonal.id });

    expect(mocks.delete).toHaveBeenCalledWith(categories);
    expect(deleteQuery.where).toHaveBeenCalledOnce();
  });

  it("rejects an active category before issuing a delete", async () => {
    configureSelect([{ ...archivedPersonal, isArchived: false }]);

    await expect(
      deleteArchivedCategory("user-a", archivedPersonal.id),
    ).rejects.toThrow("Primero archivá la categoría");
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it("does not delete another user's personal category", async () => {
    configureSelect([archivedPersonal]);

    await expect(
      deleteArchivedCategory("user-b", archivedPersonal.id),
    ).rejects.toBeInstanceOf(CategoryError);
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it("allows a group member and denies a member of another group", async () => {
    const archivedShared = {
      ...archivedPersonal,
      userId: null,
      sharedSpaceId: "space-casa",
    };
    mocks.getSharedSpaceIdsForUser.mockResolvedValue(["space-casa"]);
    configureSelect([archivedShared]);
    configureDelete([{ id: archivedShared.id }]);

    await expect(
      deleteArchivedCategory("user-a", archivedShared.id),
    ).resolves.toEqual({ id: archivedShared.id });

    mocks.getSharedSpaceIdsForUser.mockResolvedValue(["space-viaje"]);
    configureSelect([archivedShared]);

    await expect(
      deleteArchivedCategory("user-b", archivedShared.id),
    ).rejects.toBeInstanceOf(CategoryError);
  });

  it("reports if the category stopped being archived before the delete completed", async () => {
    configureSelect([archivedPersonal]);
    configureDelete([]);

    await expect(
      deleteArchivedCategory("user-a", archivedPersonal.id),
    ).rejects.toThrow("La categoría cambió mientras se procesaba");
  });
});
