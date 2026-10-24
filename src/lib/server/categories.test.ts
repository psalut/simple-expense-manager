import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  getSharedSpaceIdsForUser: vi.fn(),
  isUserMemberOfSharedSpace: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({
  db: { select: mocks.select, update: mocks.update, delete: mocks.delete },
}));
vi.mock("@/lib/server/shared-spaces", () => ({
  getSharedSpaceIdsForUser: mocks.getSharedSpaceIdsForUser,
  isUserMemberOfSharedSpace: mocks.isUserMemberOfSharedSpace,
}));

import { categories } from "@/db/categories-schema";
import {
  CategoryError,
  archiveCategory,
  deleteArchivedCategory,
  listCategoriesForSharedSpace,
} from "@/lib/server/categories";

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

function configureCategoryList(result: object[]) {
  const query = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
  };
  query.from.mockReturnValue(query);
  query.innerJoin.mockReturnValue(query);
  query.where.mockReturnValue(query);
  query.orderBy.mockResolvedValue(result);
  mocks.select.mockReturnValue(query);
  return query;
}

describe("deleteArchivedCategory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSharedSpaceIdsForUser.mockResolvedValue([]);
    mocks.isUserMemberOfSharedSpace.mockResolvedValue(false);
  });

  it("deletes an archived personal category owned by the authenticated user", async () => {
    configureSelect([archivedPersonal]);
    const deleteQuery = configureDelete([{ id: archivedPersonal.id }]);

    await expect(
      deleteArchivedCategory("user-a", archivedPersonal.id, null),
    ).resolves.toEqual({ id: archivedPersonal.id });

    expect(mocks.delete).toHaveBeenCalledWith(categories);
    expect(deleteQuery.where).toHaveBeenCalledOnce();
  });

  it("rejects an active category before issuing a delete", async () => {
    configureSelect([{ ...archivedPersonal, isArchived: false }]);

    await expect(
      deleteArchivedCategory("user-a", archivedPersonal.id, null),
    ).rejects.toThrow("Primero archivá la categoría");
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it("does not delete another user's personal category", async () => {
    configureSelect([archivedPersonal]);

    await expect(
      deleteArchivedCategory("user-b", archivedPersonal.id, null),
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
      deleteArchivedCategory("user-a", archivedShared.id, "space-casa"),
    ).resolves.toEqual({ id: archivedShared.id });

    mocks.getSharedSpaceIdsForUser.mockResolvedValue(["space-viaje"]);
    configureSelect([archivedShared]);

    await expect(
      deleteArchivedCategory("user-b", archivedShared.id, "space-casa"),
    ).rejects.toBeInstanceOf(CategoryError);
  });

  it("reports if the category stopped being archived before the delete completed", async () => {
    configureSelect([archivedPersonal]);
    configureDelete([]);

    await expect(
      deleteArchivedCategory("user-a", archivedPersonal.id, null),
    ).rejects.toThrow("La categoría cambió mientras se procesaba");
  });
});

describe("listCategoriesForSharedSpace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isUserMemberOfSharedSpace.mockResolvedValue(false);
  });

  it("does not query a group catalog for a non-member", async () => {
    await expect(
      listCategoriesForSharedSpace("user-a", "space-casa"),
    ).rejects.toBeInstanceOf(CategoryError);

    expect(mocks.select).not.toHaveBeenCalled();
  });

  it("queries the requested catalog after verifying membership", async () => {
    mocks.isUserMemberOfSharedSpace.mockResolvedValue(true);
    const row = {
      ...archivedPersonal,
      userId: null,
      sharedSpaceId: "space-casa",
      isArchived: false,
      sharedSpaceName: "Casa",
    };
    const query = configureCategoryList([row]);

    await expect(
      listCategoriesForSharedSpace("user-a", "space-casa"),
    ).resolves.toMatchObject([
      { id: row.id, scope: "shared", sharedSpaceId: "space-casa" },
    ]);

    expect(mocks.isUserMemberOfSharedSpace).toHaveBeenCalledWith(
      "user-a",
      "space-casa",
    );
    expect(query.where).toHaveBeenCalledOnce();
  });
});

describe("scope-bound category mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not archive a category from another group through a mismatched route", async () => {
    const archivedShared = {
      ...archivedPersonal,
      userId: null,
      sharedSpaceId: "space-viaje",
      isArchived: false,
    };
    mocks.getSharedSpaceIdsForUser.mockResolvedValue(["space-casa", "space-viaje"]);
    configureSelect([archivedShared]);

    await expect(
      archiveCategory("user-a", archivedShared.id, "space-casa"),
    ).rejects.toBeInstanceOf(CategoryError);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("does not permanently delete an archived category from another group", async () => {
    const archivedShared = {
      ...archivedPersonal,
      userId: null,
      sharedSpaceId: "space-viaje",
    };
    mocks.getSharedSpaceIdsForUser.mockResolvedValue(["space-casa", "space-viaje"]);
    configureSelect([archivedShared]);

    await expect(
      deleteArchivedCategory("user-a", archivedShared.id, "space-casa"),
    ).rejects.toBeInstanceOf(CategoryError);
    expect(mocks.delete).not.toHaveBeenCalled();
  });
});
