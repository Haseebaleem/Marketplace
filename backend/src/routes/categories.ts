import { Router } from "express";
import type { CategoryNode } from "@marketplace/shared";
import { prisma } from "../config/prisma";

export const categoriesRouter = Router();

const buildTree = (
  rows: { id: string; name: string; slug: string; parentId: string | null }[],
): CategoryNode[] => {
  const nodes = new Map<string, CategoryNode>();
  for (const row of rows) {
    nodes.set(row.id, { ...row, children: [] });
  }
  const roots: CategoryNode[] = [];
  for (const node of nodes.values()) {
    if (node.parentId) {
      const parent = nodes.get(node.parentId);
      if (parent) parent.children.push(node);
      else roots.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortRec = (arr: CategoryNode[]) => {
    arr.sort((a, b) => a.name.localeCompare(b.name));
    arr.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
};

categoriesRouter.get("/", async (_req, res, next) => {
  try {
    const rows = await prisma.category.findMany({
      select: { id: true, name: true, slug: true, parentId: true },
    });
    res.json({ categories: buildTree(rows) });
  } catch (err) {
    next(err);
  }
});
