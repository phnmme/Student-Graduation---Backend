// src/api/v1/user/users.authorized.service.ts

import type { Context } from "elysia";
import { PrismaClient } from "@prisma/client";
import { requireAdmin } from "../../shared/auth.helper";

const prisma = new PrismaClient();

// ─── Constants ────────────────────────────────────────────────────────────────

const TEMP_PASSWORD_LENGTH = 12;
const TEMP_PASSWORD_CHARS =
  "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// ─── Types ────────────────────────────────────────────────────────────────────

interface GetUsersQuery {
  search?: string;
  role?: string;
  hasProfile?: string;
  page?: string;
  limit?: string;
}

type JwtContext = Context["jwt"] extends undefined ? never : any;
type SetContext = Context["set"];
type HeadersContext = Context["headers"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateTempPassword(length = TEMP_PASSWORD_LENGTH): string {
  return Array.from(
    { length },
    () =>
      TEMP_PASSWORD_CHARS[
        Math.floor(Math.random() * TEMP_PASSWORD_CHARS.length)
      ]
  ).join("");
}

function buildUserWhereClause(query: GetUsersQuery) {
  const where: Record<string, unknown> = {};

  if (query.search) {
    where.OR = [
      { email: { contains: query.search, mode: "insensitive" } },
      {
        profile: {
          OR: [
            {
              firstNameTh: { contains: query.search, mode: "insensitive" },
            },
            {
              lastNameTh: { contains: query.search, mode: "insensitive" },
            },
            {
              studentCode: { contains: query.search, mode: "insensitive" },
            },
          ],
        },
      },
    ];
  }

  if (query.role && query.role !== "all") {
    where.role = query.role.toUpperCase();
  }

  if (query.hasProfile === "with") {
    where.profile = { isNot: null };
  } else if (query.hasProfile === "without") {
    where.profile = { is: null };
  }

  return where;
}

function parsePagination(query: GetUsersQuery) {
  const page = Math.max(DEFAULT_PAGE, Number(query.page) || DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Number(query.limit) || DEFAULT_LIMIT);
  return { page, limit, skip: (page - 1) * limit };
}

// ─── Prisma select shapes ─────────────────────────────────────────────────────

const USER_LIST_SELECT = {
  id: true,
  email: true,
  role: true,
  createdAt: true,
  updatedAt: true,
  profile: {
    select: {
      id: true,
      studentCode: true,
      firstNameTh: true,
      lastNameTh: true,
      phoneNumber: true,
      department: true,
      entryYear: true,
      gradYear: true,
      jobField: true,
      continued_from_coop: true,
      employment_sector: true,
    },
  },
} as const;

const USER_DETAIL_SELECT = {
  id: true,
  email: true,
  role: true,
  createdAt: true,
  updatedAt: true,
  profile: true,
  _count: {
    select: { logs: true, careerReviews: true },
  },
} as const;

// ─── Service ──────────────────────────────────────────────────────────────────

export class UserService {
  /**
   * GET /api/v1/user/authorized/users
   * ดึงรายชื่อผู้ใช้ทั้งหมด (เฉพาะ Admin)
   */
  async getUsers(
    query: GetUsersQuery,
    jwt: JwtContext,
    set: SetContext,
    headers: HeadersContext
  ) {
    const decoded = await requireAdmin(jwt, set, headers);
    if (!decoded) return { message: "ไม่มีสิทธิ์เข้าถึง" };

    const { page, limit, skip } = parsePagination(query);
    const where = buildUserWhereClause(query);

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: USER_LIST_SELECT,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return {
      message: "รายชื่อผู้ใช้งาน",
      data: users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * GET /api/v1/user/authorized/users/:id
   * ดูข้อมูลผู้ใช้รายบุคคล
   */
  async getUserById(
    id: number,
    jwt: JwtContext,
    set: SetContext,
    headers: HeadersContext
  ) {
    const decoded = await requireAdmin(jwt, set, headers);
    if (!decoded) return { message: "ไม่มีสิทธิ์เข้าถึง" };

    const user = await prisma.user.findUnique({
      where: { id },
      select: USER_DETAIL_SELECT,
    });

    if (!user) {
      set.status = 404;
      return { message: "ไม่พบผู้ใช้" };
    }

    return { message: "ข้อมูลผู้ใช้", data: user };
  }

  /**
   * DELETE /api/v1/user/authorized/users/:id
   * ลบบัญชีผู้ใช้ (Admin ลบ User ได้, Owner ลบ Admin ได้)
   */
  async deleteUser(
    id: number,
    jwt: JwtContext,
    set: SetContext,
    headers: HeadersContext
  ) {
    const decoded = await requireAdmin(jwt, set, headers);
    if (!decoded) return { message: "ไม่มีสิทธิ์เข้าถึง" };

    const [caller, target] = await Promise.all([
      prisma.user.findUnique({ where: { id: decoded.id } }),
      prisma.user.findUnique({ where: { id } }),
    ]);

    if (!target) {
      set.status = 404;
      return { message: "ไม่พบผู้ใช้" };
    }

    if (target.id === decoded.id) {
      set.status = 400;
      return { message: "ไม่สามารถลบบัญชีตัวเองได้" };
    }

    if (target.role === "OWNER") {
      set.status = 403;
      return { message: "ไม่สามารถลบบัญชี OWNER ได้" };
    }

    if (target.role === "ADMIN" && caller?.role !== "OWNER") {
      set.status = 403;
      return { message: "เฉพาะ OWNER เท่านั้นที่สามารถลบ Admin ได้" };
    }

    await prisma.user.delete({ where: { id } });

    await prisma.log.create({
      data: {
        action: "USER_DELETED",
        details: `ลบบัญชีผู้ใช้ ${target.email} (ID #${id})`,
        userId: decoded.id,
      },
    });

    return { message: "ลบผู้ใช้สำเร็จ" };
  }

  /**
   * POST /api/v1/user/authorized/users/:id/reset-password
   * สร้าง Temp Password และ hash เก็บใน DB (เฉพาะ Admin)
   */
  async resetPassword(
    id: number,
    jwt: JwtContext,
    set: SetContext,
    headers: HeadersContext
  ) {
    const decoded = await requireAdmin(jwt, set, headers);
    if (!decoded) return { message: "ไม่มีสิทธิ์เข้าถึง" };

    const target = await prisma.user.findUnique({ where: { id } });

    if (!target) {
      set.status = 404;
      return { message: "ไม่พบผู้ใช้" };
    }

    if (target.role === "OWNER") {
      set.status = 403;
      return { message: "ไม่สามารถรีเซ็ตรหัสผ่านของ OWNER ได้" };
    }

    const tempPassword = generateTempPassword();
    const hashed = await Bun.password.hash(tempPassword, {
      algorithm: "bcrypt",
      cost: 10,
    });

    await Promise.all([
      prisma.user.update({
        where: { id },
        data: { password: hashed },
      }),
      prisma.log.create({
        data: {
          action: "PASSWORD_RESET",
          details: `รีเซ็ตรหัสผ่านของ ${target.email} โดย Admin (ID #${decoded.id})`,
          userId: decoded.id,
        },
      }),
    ]);

    return {
      message: "รีเซ็ตรหัสผ่านสำเร็จ",
      data: {
        tempPassword,
        expiresIn: "24h",
        userId: id,
        email: target.email,
      },
    };
  }
}
