import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export class statisticsGuestService {
  async getDashboardStats(years: number = 5) {
    try {
      const currentYear = new Date().getFullYear();
      const fromYear = currentYear - years + 1;

      const yearFilter = {
        gradYear: {
          not: null,
          gte: fromYear,
        },
      };

      const [graduates, coop, sectorData, allProfiles] = await Promise.all([
        // จำนวนนักศึกษาที่จบแต่ละปี
        prisma.studentProfile.groupBy({
          by: ["gradYear"],
          where: yearFilter,
          _count: { id: true },
        }),

        // จำนวนที่ต่อเนื่องจากสหกิจ
        prisma.studentProfile.groupBy({
          by: ["gradYear"],
          where: {
            ...yearFilter,
            continued_from_coop: true,
          },
          _count: { id: true },
        }),

        // สถิติแยกตาม sector และปีที่จบ
        prisma.studentProfile.groupBy({
          by: ["gradYear", "employment_sector"],
          where: {
            ...yearFilter,
            employment_sector: { not: null },
          },
          _count: { id: true },
        }),

        prisma.studentProfile.findMany({
          where: yearFilter,
          select: {
            entryYear: true,
            gradYear: true,
          },
        }),
      ]);

      // ── 1. Coop Chart ──────────────────────────────────────────────
      const coopMap = new Map(coop.map((c) => [c.gradYear, c._count.id]));

      const graduateChart = graduates
        .map((g) => ({
          year: g.gradYear!,
          graduates: g._count.id,
          coopEmployed: coopMap.get(g.gradYear) || 0,
        }))
        .sort((a, b) => a.year - b.year);

      const PROGRAM_DURATION = 3;

      const gradStatusMap = new Map<
        number,
        { year: number; onTime: number; late: number }
      >();

      for (const { entryYear, gradYear } of allProfiles) {
        if (gradYear === null) continue;

        if (!gradStatusMap.has(gradYear)) {
          gradStatusMap.set(gradYear, { year: gradYear, onTime: 0, late: 0 });
        }

        const item = gradStatusMap.get(gradYear)!;
        const expectedGradYear = entryYear + PROGRAM_DURATION;

        if (gradYear <= expectedGradYear) {
          item.onTime += 1;
        } else {
          item.late += 1;
        }
      }

      const graduationStatusChart = Array.from(gradStatusMap.values()).sort(
        (a, b) => a.year - b.year
      );

      const sectorMap = new Map<
        number,
        {
          year: number;
          private: number;
          government: number;
          stateEnterprise: number;
          selfEmployed: number;
        }
      >();

      for (const row of sectorData) {
        const year = row.gradYear!;

        if (!sectorMap.has(year)) {
          sectorMap.set(year, {
            year,
            private: 0,
            government: 0,
            stateEnterprise: 0,
            selfEmployed: 0,
          });
        }

        const item = sectorMap.get(year)!;

        switch (row.employment_sector) {
          case "PRIVATE":
            item.private = row._count.id;
            break;
          case "GOVERNMENT":
            item.government = row._count.id;
            break;
          case "STATE_ENTERPRISE":
            item.stateEnterprise = row._count.id;
            break;
          case "SELF_EMPLOYED":
            item.selfEmployed = row._count.id;
            break;
        }
      }

      const employmentSectorChart = Array.from(sectorMap.values()).sort(
        (a, b) => a.year - b.year
      );

      return {
        message: "ดึงข้อมูลสถิติสำเร็จ",
        data: {
          coopChart: graduateChart,
          graduationStatusChart,
          employmentSectorChart,
        },
      };
    } catch (error) {
      console.error("Dashboard stats error:", error);
      throw new Error("Failed to load dashboard statistics");
    }
  }
}
