import { Elysia, t } from "elysia";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const reviewGuestController = new Elysia().group(
  "/api/v1/review/guest",
  (app) =>
    app.get(
      "/approved",
      async ({ query, set }) => {
        try {
          const page = Math.max(1, Number(query.page) || 1);
          const limit = Math.min(30, Math.max(1, Number(query.limit) || 12));
          const search = query.search?.trim();
          const category =
            query.category === "CAREER_PREP" ||
            query.category === "CURRICULUM_IMPROVEMENT"
              ? query.category
              : undefined;

          const where: Prisma.CareerReviewWhereInput = {
            status: "approved",
            ...(category ? { category } : {}),
            ...(search
              ? {
                  OR: [
                    { title: { contains: search, mode: "insensitive" } },
                    { description: { contains: search, mode: "insensitive" } },
                    { jobField: { contains: search, mode: "insensitive" } },
                  ],
                }
              : {}),
          };

          const [total, reviews] = await Promise.all([
            prisma.careerReview.count({ where }),
            prisma.careerReview.findMany({
              where,
              select: {
                id: true,
                title: true,
                description: true,
                jobField: true,
                category: true,
                createdAt: true,
              },
              orderBy: { createdAt: "desc" },
              skip: (page - 1) * limit,
              take: limit,
            }),
          ]);

          return {
            message: "รีวิวที่ได้รับการอนุมัติ",
            data: reviews.map((review) => ({
              ...review,
              authorName: "ศิษย์เก่า IPTM",
            })),
            pagination: {
              total,
              page,
              limit,
              totalPages: Math.ceil(total / limit),
            },
          };
        } catch {
          set.status = 500;
          return { message: "ไม่สามารถโหลดรีวิวได้ในขณะนี้" };
        }
      },
      {
        query: t.Object({
          page: t.Optional(t.String()),
          limit: t.Optional(t.String()),
          search: t.Optional(t.String({ maxLength: 100 })),
          category: t.Optional(t.String()),
        }),
      }
    )
);
