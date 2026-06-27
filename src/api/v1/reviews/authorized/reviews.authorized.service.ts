// src/api/v1/review/reviews.authorized.service.ts

import { Context } from "elysia";
import { PrismaClient, Prisma } from "@prisma/client";
import { requireAdmin, requireAuth } from "../../shared/auth.helper";

const prisma = new PrismaClient();

// ─── Types ───────────────────────────────────────────────────────────────────

type ReviewStatus = "pending" | "approved" | "rejected";

interface GetReviewsQuery {
  status?: string;
  search?: string;
  jobField?: string;
  page?: string;
  limit?: string;
}

interface CreateReviewBody {
  title: string;
  description: string;
  jobField?: string;
}

interface UpdateStatusBody {
  status: ReviewStatus;
}

// ─── Shared Prisma selects ────────────────────────────────────────────────────

const userSelect = {
  id: true,
  email: true,
  role: true,
  profile: {
    select: {
      firstNameTh: true,
      lastNameTh: true,
      studentCode: true,
    },
  },
} satisfies Prisma.UserSelect;

// ─── Service ─────────────────────────────────────────────────────────────────

export class ReviewService {
  /**
   * GET /reviews
   * Admin sees all reviews. Regular users see only their own.
   */
  async getReviews(
    query: GetReviewsQuery,
    jwt: any,
    set: Context["set"],
    headers: Context["headers"]
  ) {
    const decoded = await requireAuth(jwt, set, headers);
    if (!decoded) return { message: "ไม่มีสิทธิ์เข้าถึง" };

    const caller = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!caller) {
      set.status = 401;
      return { message: "ไม่พบผู้ใช้" };
    }

    const isAdmin = caller.role === "ADMIN" || caller.role === "OWNER";
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Number(query.limit) || 20);
    const skip = (page - 1) * limit;

    const where: Prisma.CareerReviewWhereInput = {};

    if (!isAdmin) {
      where.userId = decoded.id;
    }

    if (query.status && query.status !== "all") {
      where.status = query.status;
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } },
        { jobField: { contains: query.search, mode: "insensitive" } },
        {
          user: {
            profile: {
              OR: [
                {
                  firstNameTh: { contains: query.search, mode: "insensitive" },
                },
                { lastNameTh: { contains: query.search, mode: "insensitive" } },
              ],
            },
          },
        },
      ];
    }

    if (query.jobField && query.jobField !== "all") {
      where.jobField = { equals: query.jobField, mode: "insensitive" };
    }

    const [total, reviews] = await Promise.all([
      prisma.careerReview.count({ where }),
      prisma.careerReview.findMany({
        where,
        include: { user: { select: userSelect } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return {
      message: "รายการ Career Review",
      data: reviews,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * GET /reviews/:id
   * Admin can view any review; user can only view their own.
   */
  async getReviewById(
    id: number,
    jwt: any,
    set: Context["set"],
    headers: Context["headers"]
  ) {
    const decoded = await requireAuth(jwt, set, headers);
    if (!decoded) return { message: "ไม่มีสิทธิ์เข้าถึง" };

    const [review, caller] = await Promise.all([
      prisma.careerReview.findUnique({
        where: { id },
        include: { user: { select: userSelect } },
      }),
      prisma.user.findUnique({ where: { id: decoded.id } }),
    ]);

    if (!review) {
      set.status = 404;
      return { message: "ไม่พบ Review" };
    }

    const isAdmin = caller?.role === "ADMIN" || caller?.role === "OWNER";
    if (!isAdmin && review.userId !== decoded.id) {
      set.status = 403;
      return { message: "ไม่มีสิทธิ์เข้าถึง Review นี้" };
    }

    return { message: "ข้อมูล Review", data: review };
  }

  /**
   * POST /reviews
   * Any authenticated user can create a review.
   */
  async createReview(
    body: CreateReviewBody,
    jwt: any,
    set: Context["set"],
    headers: Context["headers"]
  ) {
    const decoded = await requireAuth(jwt, set, headers);
    if (!decoded) return { message: "ไม่มีสิทธิ์เข้าถึง" };

    const review = await prisma.careerReview.create({
      data: {
        title: body.title,
        description: body.description,
        jobField: body.jobField,
        userId: decoded.id,
      },
    });

    await prisma.log.create({
      data: {
        action: "REVIEW_CREATED",
        details: `สร้าง Review: "${body.title}"`,
        userId: decoded.id,
      },
    });

    return { message: "สร้าง Review สำเร็จ", data: review };
  }

  /**
   * PATCH /reviews/:id/status
   * Admin only — approve or reject a review.
   */
  async updateReviewStatus(
    id: number,
    body: UpdateStatusBody,
    jwt: any,
    set: Context["set"],
    headers: Context["headers"]
  ) {
    const decoded = await requireAdmin(jwt, set, headers);
    if (!decoded) return { message: "ไม่มีสิทธิ์เข้าถึง" };

    const review = await prisma.careerReview.findUnique({ where: { id } });
    if (!review) {
      set.status = 404;
      return { message: "ไม่พบ Review" };
    }

    const updated = await prisma.careerReview.update({
      where: { id },
      data: { status: body.status },
    });

    const actionLabel = body.status === "approved" ? "อนุมัติ" : "ปฏิเสธ";

    await prisma.log.create({
      data: {
        action: `REVIEW_${body.status.toUpperCase()}`,
        details: `${actionLabel} Review ID #${id}: "${review.title}"`,
        userId: decoded.id,
      },
    });

    return { message: `${actionLabel} Review สำเร็จ`, data: updated };
  }

  /**
   * DELETE /reviews/:id
   * Admin can delete any review; user can delete only their own.
   */
  async deleteReview(
    id: number,
    jwt: any,
    set: Context["set"],
    headers: Context["headers"]
  ) {
    const decoded = await requireAuth(jwt, set, headers);
    if (!decoded) return { message: "ไม่มีสิทธิ์เข้าถึง" };

    const [review, caller] = await Promise.all([
      prisma.careerReview.findUnique({ where: { id } }),
      prisma.user.findUnique({ where: { id: decoded.id } }),
    ]);

    if (!review) {
      set.status = 404;
      return { message: "ไม่พบ Review" };
    }

    const isAdmin = caller?.role === "ADMIN" || caller?.role === "OWNER";
    if (!isAdmin && review.userId !== decoded.id) {
      set.status = 403;
      return { message: "ไม่มีสิทธิ์ลบ Review นี้" };
    }

    await prisma.careerReview.delete({ where: { id } });

    await prisma.log.create({
      data: {
        action: "REVIEW_DELETED",
        details: `ลบ Review ID #${id}: "${review.title}"`,
        userId: decoded.id,
      },
    });

    return { message: "ลบ Review สำเร็จ" };
  }

  /**
   * GET /reviews/jobfields
   * Returns distinct job fields for the filter dropdown.
   */
  async getJobFields(
    jwt: any,
    set: Context["set"],
    headers: Context["headers"]
  ) {
    const decoded = await requireAuth(jwt, set, headers);
    if (!decoded) return { message: "ไม่มีสิทธิ์เข้าถึง" };

    const fields = await prisma.careerReview.findMany({
      where: { jobField: { not: null } },
      select: { jobField: true },
      distinct: ["jobField"],
      orderBy: { jobField: "asc" },
    });

    return {
      message: "รายชื่อสายงาน",
      data: fields.map((f) => f.jobField).filter(Boolean),
    };
  }
}
