import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

export class studentsGuestService {
  async getAllYear() {
    const years = await prisma.studentProfile.findMany({
      select: { gradYear: true },
      where: { gradYear: { not: null } },
      distinct: ["gradYear"],
      orderBy: { gradYear: "desc" },
    });

    if (years.length === 0) {
      return { message: "ไม่พบข้อมูลปีการศึกษา", data: { years: [] } };
    }

    return {
      message: "ดึงข้อมูลปีการศึกษาสำเร็จ",
      data: { years: years.map((y) => y.gradYear) },
    };
  }

  async getAllStudentsGrouped() {
    const years = await prisma.studentProfile.findMany({
      select: { gradYear: true },
      where: { gradYear: { not: null } },
      distinct: ["gradYear"],
      orderBy: { gradYear: "desc" },
    });

    const gradYears = years.map((y) => y.gradYear!);

    const counts = await prisma.studentProfile.groupBy({
      by: ["gradYear"],
      _count: { gradYear: true },
    });

    const countMap = counts.reduce((acc, item) => {
      acc[item.gradYear!] = item._count.gradYear;
      return acc;
    }, {} as Record<number, number>);

    const groups = await Promise.all(
      gradYears.map(async (y) => {
        const total = await prisma.studentProfile.count({
          where: { gradYear: y },
        });

        const students = await prisma.studentProfile.findMany({
          where: { gradYear: y },
          take: 10,
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            studentCode: true,
            firstNameTh: true,
            lastNameTh: true,
            department: true,
            entryYear: true,
            gradYear: true,
            jobField: true,
          },
        });

        return {
          gradYear: y,
          count: total,
          students,
          nextSkip: students.length,
          hasMore: students.length < total,
        };
      })
    );

    return {
      message: "ดึงข้อมูลนักศึกษาทั้งหมดสำเร็จ",
      data: { groups },
    };
  }

  async getStudentByYear(year: number, search = "", skip = 0, limit = 10) {
    const where: Prisma.StudentProfileWhereInput = {
      gradYear: year,
      ...(search && {
        OR: [
          {
            studentCode: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            firstNameTh: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            lastNameTh: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            department: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            jobField: {
              contains: search,
              mode: "insensitive",
            },
          },
        ],
      }),
    };

    const total = await prisma.studentProfile.count({
      where,
    });

    const students = await prisma.studentProfile.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        id: true,
        studentCode: true,
        firstNameTh: true,
        lastNameTh: true,
        department: true,
        entryYear: true,
        gradYear: true,
        jobField: true,
      },
    });

    return {
      message: "ดึงข้อมูลนักศึกษาสำเร็จ",
      data: {
        gradYear: year,
        count: total,
        students,
        nextSkip: skip + students.length,
        hasMore: skip + students.length < total,
      },
    };
  }
}
