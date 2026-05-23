import { PrismaClient } from "@prisma/client";
import { slugify } from "../src/utils/slug";

const prisma = new PrismaClient();

interface CategorySeed {
  name: string;
  children?: CategorySeed[];
}

const CATEGORIES: CategorySeed[] = [
  {
    name: "Electronics",
    children: [
      { name: "Phones" },
      { name: "Laptops" },
      { name: "Headphones" },
    ],
  },
  { name: "Clothing" },
  { name: "Home & Kitchen" },
  { name: "Books" },
  { name: "Sports & Outdoors" },
  { name: "Beauty & Personal Care" },
];

const ensureCategory = async (
  spec: CategorySeed,
  parentId: string | null,
): Promise<void> => {
  const slug = slugify(spec.name);
  const existing = await prisma.category.findUnique({ where: { slug } });
  let id: string;
  if (existing) {
    id = existing.id;
  } else {
    const created = await prisma.category.create({
      data: { name: spec.name, slug, parentId },
    });
    id = created.id;
    // eslint-disable-next-line no-console
    console.log(`  + category "${spec.name}" (${slug})`);
  }
  if (spec.children) {
    for (const child of spec.children) {
      await ensureCategory(child, id);
    }
  }
};

const main = async () => {
  // eslint-disable-next-line no-console
  console.log("Seeding categories…");
  for (const top of CATEGORIES) {
    await ensureCategory(top, null);
  }
  // eslint-disable-next-line no-console
  console.log("Done.");
};

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
