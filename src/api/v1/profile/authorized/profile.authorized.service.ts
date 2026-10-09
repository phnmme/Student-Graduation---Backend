import { Context } from "elysia";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export class profileAuthorizedService {
  private async getUserId(jwt: any, headers: Context["headers"]) {
    const auth = headers.authorization;
    if (!auth?.startsWith("Bearer ")) return null;
    const decoded = await jwt.verify(auth.slice(7));
    return decoded?.id ? Number(decoded.id) : null;
  }

  async getProfile(jwt: any, set: Context["set"], headers: Context["headers"]) {
    try {
      const userId = await this.getUserId(jwt, headers);
      if (!userId) {
        set.status = 401;
        return { message: "ไม่มีสิทธิ์เข้าถึง" };
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          profile: {
            include: {
              employmentHistory: { orderBy: [{ startYear: "desc" }, { createdAt: "desc" }] },
            },
          },
        },
      });

      if (!user) {
        set.status = 404;
        return { message: "ไม่พบผู้ใช้" };
      }

      return { message: "ข้อมูลโปรไฟล์", data: { user } };
    } catch {
      set.status = 401;
      return { message: "โทเค็นไม่ถูกต้อง" };
    }
  }

  async updateProfile(
    body: {
      fullname?: string;
      studentCode?: string;
      department?: string;
      gradYear?: number;
      jobField?: string;
      companyName?: string | null;
      jobStartYear?: number | null;
      continuedFromCoop?: boolean;
      employmentSector?: "PRIVATE" | "GOVERNMENT" | "STATE_ENTERPRISE" | "SELF_EMPLOYED" | null;
      continued_from_coop?: boolean;
      employment_sector?: "PRIVATE" | "GOVERNMENT" | "STATE_ENTERPRISE" | "SELF_EMPLOYED" | null;
    },
    jwt: any,
    set: Context["set"],
    headers: Context["headers"]
  ) {
    try {
      const userId = await this.getUserId(jwt, headers);
      if (!userId) {
        set.status = 401;
        return { message: "ไม่มีสิทธิ์เข้าถึง" };
      }

      const parts = body.fullname?.trim().split(/\s+/) || [];
      const continued = body.continuedFromCoop ?? body.continued_from_coop;
      const sector = body.employmentSector !== undefined
        ? body.employmentSector
        : body.employment_sector;

      // Automatically preserve the previous job title whenever it changes.
      if (body.jobField !== undefined) {
        const profile = await prisma.studentProfile.findUnique({
          where: { userId },
          select: { id: true, jobField: true, companyName: true, jobStartYear: true },
        });
        const previousJob = profile?.jobField?.trim();
        const nextJob = body.jobField.trim();

        if (profile && previousJob && previousJob !== nextJob) {
          await prisma.employmentHistory.create({
            data: {
              profileId: profile.id,
              jobTitle: previousJob,
              companyName: profile.companyName,
              startYear: profile.jobStartYear,
              description: "บันทึกอัตโนมัติเมื่อมีการเปลี่ยนตำแหน่งงาน",
            },
          });
        }
      }

      await prisma.studentProfile.update({
        where: { userId },
        data: {
          firstNameTh: parts[0] || undefined,
          lastNameTh: parts.length > 1 ? parts.slice(1).join(" ") : undefined,
          studentCode: body.studentCode?.trim() || undefined,
          department: body.department?.trim() || undefined,
          gradYear: body.gradYear ?? undefined,
          jobField: body.jobField === undefined ? undefined : (body.jobField.trim() || null),
          companyName: body.companyName === undefined ? undefined : (body.companyName?.trim() || null),
          jobStartYear: body.jobStartYear === undefined ? undefined : (body.jobStartYear ?? null),
          continued_from_coop: continued ?? undefined,
          employment_sector: sector === undefined ? undefined : sector,
        },
      });

      return { message: "อัปเดตโปรไฟล์สำเร็จ" };
    } catch (error) {
      console.error("updateProfile error:", error);
      set.status = 400;
      return { message: "ไม่สามารถอัปเดตโปรไฟล์ได้ กรุณาตรวจสอบข้อมูล" };
    }
  }

  async addJobHistory(
    body: { jobTitle: string; companyName: string; startYear: number; description?: string },
    jwt: any,
    set: Context["set"],
    headers: Context["headers"]
  ) {
    try {
      const userId = await this.getUserId(jwt, headers);
      if (!userId) {
        set.status = 401;
        return { message: "ไม่มีสิทธิ์เข้าถึง" };
      }
      const profile = await prisma.studentProfile.findUnique({ where: { userId }, select: { id: true } });
      if (!profile) {
        set.status = 404;
        return { message: "ไม่พบโปรไฟล์นักศึกษา" };
      }
      const job = await prisma.employmentHistory.create({
        data: {
          profileId: profile.id,
          jobTitle: body.jobTitle.trim(),
          companyName: body.companyName.trim(),
          startYear: body.startYear,
          description: body.description?.trim() || null,
        },
      });
      set.status = 201;
      return { message: "เพิ่มประวัติงานสำเร็จ", data: job };
    } catch (error) {
      console.error("addJobHistory error:", error);
      set.status = 400;
      return { message: "ไม่สามารถเพิ่มประวัติงานได้" };
    }
  }

  async deleteJobHistory(id: number, jwt: any, set: Context["set"], headers: Context["headers"]) {
    try {
      const userId = await this.getUserId(jwt, headers);
      if (!userId) {
        set.status = 401;
        return { message: "ไม่มีสิทธิ์เข้าถึง" };
      }
      const profile = await prisma.studentProfile.findUnique({ where: { userId }, select: { id: true } });
      if (!profile) {
        set.status = 404;
        return { message: "ไม่พบโปรไฟล์นักศึกษา" };
      }
      const job = await prisma.employmentHistory.findFirst({ where: { id, profileId: profile.id }, select: { id: true } });
      if (!job) {
        set.status = 404;
        return { message: "ไม่พบประวัติงานนี้" };
      }
      await prisma.employmentHistory.delete({ where: { id } });
      return { message: "ลบประวัติงานสำเร็จ" };
    } catch (error) {
      console.error("deleteJobHistory error:", error);
      set.status = 400;
      return { message: "ไม่สามารถลบประวัติงานได้" };
    }
  }
}
