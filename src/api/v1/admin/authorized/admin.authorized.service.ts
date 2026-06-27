// src/api/v1/admin/admin.authorized.service.ts

import { Context } from "elysia";
import { PrismaClient, Role } from "@prisma/client";
import { requireAdmin } from "../../shared/auth.helper";

const prisma = new PrismaClient();

const ONE_HOUR_MS = 60 * 60 * 1000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function unauthorized(set: Context["set"]) {
  set.status = 401;
  return { message: "ไม่มีสิทธิ์เข้าถึง" };
}

function forbidden(set: Context["set"], message: string) {
  set.status = 403;
  return { message };
}

function notFound(set: Context["set"], message: string) {
  set.status = 404;
  return { message };
}

function conflict(set: Context["set"], message: string) {
  set.status = 409;
  return { message };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class AdminAuthorizedService {
  async getAdmins(jwt: any, set: Context["set"], headers: Context["headers"]) {
    const decoded = await requireAdmin(jwt, set, headers);
    if (!decoded) return unauthorized(set);

    const admins = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "OWNER"] } },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        profile: {
          select: { firstNameTh: true, lastNameTh: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const adminIds = admins.map((a) => a.id);

    // ดึง login log ล่าสุดของทุก admin ในคำสั่งเดียว
    const latestLogins = await prisma.log.findMany({
      where: { action: "LOGIN", userId: { in: adminIds } },
      select: { userId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      distinct: ["userId"],
    });

    const loginMap = new Map(
      latestLogins
        .filter((l) => l.userId !== null)
        .map((l) => [l.userId!, l.createdAt])
    );

    const now = Date.now();

    const data = admins.map((admin) => {
      const lastLoginAt = loginMap.get(admin.id) ?? null;
      return {
        ...admin,
        lastLoginAt,
        isOnline: lastLoginAt
          ? now - lastLoginAt.getTime() <= ONE_HOUR_MS
          : false,
      };
    });

    return { message: "รายชื่อผู้ดูแลระบบ", data };
  }

  async createAdmin(
    body: { email: string },
    jwt: any,
    set: Context["set"],
    headers: Context["headers"]
  ) {
    const decoded = await requireAdmin(jwt, set, headers);
    if (!decoded) return unauthorized(set);

    const caller = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (caller?.role !== "OWNER") {
      return forbidden(set, "เฉพาะ OWNER เท่านั้นที่สามารถเพิ่ม Admin ได้");
    }

    const target = await prisma.user.findUnique({
      where: { email: body.email },
    });

    if (!target) {
      return notFound(set, "ไม่พบผู้ใช้ที่มีอีเมลนี้");
    }

    if (target.role === "ADMIN" || target.role === "OWNER") {
      return conflict(set, "ผู้ใช้นี้มีสิทธิ์ Admin อยู่แล้ว");
    }

    const [updated] = await prisma.$transaction([
      prisma.user.update({
        where: { email: body.email },
        data: { role: "ADMIN" },
        select: { id: true, email: true, role: true },
      }),
      prisma.log.create({
        data: {
          action: "ADMIN_CREATED",
          details: `เปลี่ยน role ของ ${body.email} เป็น ADMIN`,
          userId: decoded.id,
        },
      }),
    ]);

    return { message: "เพิ่ม Admin สำเร็จ", data: updated };
  }

  async deleteAdmin(
    id: number,
    jwt: any,
    set: Context["set"],
    headers: Context["headers"]
  ) {
    const decoded = await requireAdmin(jwt, set, headers);
    if (!decoded) return unauthorized(set);

    const caller = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (caller?.role !== "OWNER") {
      return forbidden(set, "เฉพาะ OWNER เท่านั้นที่สามารถถอดสิทธิ์ Admin ได้");
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      return notFound(set, "ไม่พบผู้ใช้");
    }

    if (target.role === "OWNER") {
      return forbidden(set, "ไม่สามารถถอดสิทธิ์ OWNER ได้");
    }

    const [updated] = await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: { role: "USER" },
        select: { id: true, email: true, role: true },
      }),
      prisma.log.create({
        data: {
          action: "ADMIN_REMOVED",
          details: `ถอดสิทธิ์ Admin ของ ${target.email}`,
          userId: decoded.id,
        },
      }),
    ]);

    return { message: "ถอดสิทธิ์ Admin สำเร็จ", data: updated };
  }
}
