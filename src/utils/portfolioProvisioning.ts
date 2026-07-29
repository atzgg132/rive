import { prisma } from "@/utils/db";
import {
  buildPrefilledPortfolioContent,
  DEFAULT_PORTFOLIO_THEME,
  normalizeSlug,
} from "@/utils/portfolio";

export async function ensurePrefilledPortfolio(
  userId: string,
  options: { requestedSlug?: string; templateKey?: string } = {},
) {
  const existing = await prisma.portfolio.findUnique({ where: { userId } });
  if (existing) return { portfolio: existing, created: false };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      avatarUrl: true,
      email: true,
      profession: true,
      projects: {
        orderBy: { updatedAt: "desc" },
        take: 12,
        select: {
          id: true,
          title: true,
          description: true,
          tags: true,
          startDate: true,
          updatedAt: true,
        },
      },
    },
  });
  if (!user) throw new Error("User not found.");

  const requested = normalizeSlug(options.requestedSlug || "");
  const baseSlug = requested || normalizeSlug(user.email.split("@")[0]) || "portfolio";
  let slug = baseSlug;
  let suffix = 2;
  while (await prisma.portfolio.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${baseSlug}-${suffix++}`;
  }

  try {
    const portfolio = await prisma.portfolio.create({
      data: {
        userId,
        slug,
        templateKey: options.templateKey || "minimal-pro",
        content: buildPrefilledPortfolioContent(user),
        theme: DEFAULT_PORTFOLIO_THEME,
        seo: { title: "", description: "", indexable: true },
      },
    });
    return { portfolio, created: true };
  } catch (error) {
    // Concurrent first-run requests can race; the user-scoped unique record wins safely.
    const portfolio = await prisma.portfolio.findUnique({ where: { userId } });
    if (portfolio) return { portfolio, created: false };
    throw error;
  }
}
