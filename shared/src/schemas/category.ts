import { z } from "zod";

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  children: CategoryNode[];
}

export const categoryNodeSchema: z.ZodType<CategoryNode> = z.lazy(() =>
  z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    parentId: z.string().uuid().nullable(),
    children: z.array(categoryNodeSchema),
  }),
);
