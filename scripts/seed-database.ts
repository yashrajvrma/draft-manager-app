import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@/db";
import { auth } from "@/lib/auth";

type SeedDraft = {
  id: number;
  title: string;
  type: string;
  body: string;
  tags: string[];
  author: string;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

const TEST_USERS = [
  { name: "Alice", email: "alice@test.com", password: "password123" },
  { name: "Bob", email: "bob@test.com", password: "password123" },
];

async function seedDrafts() {
  const file = join(process.cwd(), "data", "seed_drafts.json");
  const rows = JSON.parse(readFileSync(file, "utf8")) as SeedDraft[];

  await prisma.draft.deleteMany();
  await prisma.draft.createMany({
    data: rows.map((r) => ({
      id: r.id,
      title: r.title,
      type: r.type,
      body: r.body,
      tags: r.tags,
      author: r.author,
      status: r.status,
      version: r.version,
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
    })),
  });
  console.log(`Seeded ${rows.length} drafts.`);
}

async function seedUsers() {
  for (const u of TEST_USERS) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (existing) {
      console.log(`User ${u.email} already exists, skipping.`);
      continue;
    }
    await auth.api.signUpEmail({
      body: { name: u.name, email: u.email, password: u.password },
    });
    console.log(`Created user ${u.email} (password: ${u.password}).`);
  }
}

async function main() {
  await seedDrafts();
  await seedUsers();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
