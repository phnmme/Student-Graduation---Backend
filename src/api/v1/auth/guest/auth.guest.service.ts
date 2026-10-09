import type { Context } from "elysia";
import { passwordUtil } from "../../../../utils/hash";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export class AuthGuestService {
  async login(
    body: { email: string; password: string },
    jwt: any,
    set: Context["set"]
  ) {
    const { email, password } = body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        profile: true,
      },
    });

    if (!user) {
      set.status = 401;
      return {
        success: false,
        message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
      };
    }

    const isMatch = await passwordUtil.verify(password, user.password);

    if (!isMatch) {
      set.status = 401;
      return {
        success: false,
        message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
      };
    }

    if (user.tempPasswordExpiresAt && user.tempPasswordExpiresAt.getTime() <= Date.now()) {
      set.status = 401;
      return {
        success: false,
        code: "TEMP_PASSWORD_EXPIRED",
        message: "รหัสผ่านชั่วคราวหมดอายุแล้ว กรุณาติดต่อผู้ดูแลระบบเพื่อรีเซ็ตรหัสผ่านอีกครั้ง",
      };
    }

    const token = await jwt.sign({
      id: user.id,
      email: user.email,
      name: user.profile?.firstNameTh + " " + user.profile?.lastNameTh,
      role: user.role,
      exp: "1h",
    });

    await prisma.log.create({
      data: {
        action: "LOGIN",
        details: `ผู้ใช้ ${email} เข้าสู่ระบบสำเร็จ`,
        userId: user.id,
      },
    });

    return {
      message: "เข้าสู่ระบบสำเร็จ",
      data: {
        token,
      },
    };
  }
  async register(
    body: {
      email: string;
      password: string;
      confirmPassword: string;
      studentCode: string;
      firstNameTh: string;
      lastNameTh: string;
      phoneNumber: string;
      entryYear: number;
    },
    set: Context["set"]
  ) {
    const {
      email,
      password,
      confirmPassword,
      studentCode,
      firstNameTh,
      lastNameTh,
      phoneNumber,
      entryYear,
    } = body;

    if (password !== confirmPassword) {
      set.status = 400;
      return {
        message: "รหัสผ่านไม่ตรงกัน",
      };
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    const existingStudentCode = await prisma.studentProfile.findUnique({
      where: { studentCode },
    });

    if (existingUser || existingStudentCode) {
      set.status = 409;
      return {
        message: "อีเมลหรือรหัสประจำตัวนักศึกษาถูกใช้งานแล้ว",
      };
    }

    const hashedPassword = await passwordUtil.hash(password);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        profile: {
          create: {
            studentCode: studentCode,
            firstNameTh: firstNameTh,
            lastNameTh: lastNameTh,
            phoneNumber,
            department: "การจัดการเทคโนโลยีสารการผลิตและสารสนเทศ",
            entryYear: entryYear,
            jobField: "ไม่ระบุ",
          },
        },
      },
    });

    if (!user) {
      set.status = 500;
      return {
        message: "เกิดข้อผิดพลาดในการสมัครสมาชิก",
      };
    }
    await prisma.log.create({
      data: {
        action: "REGISTER",
        details: `ผู้ใช้ ${email} สมัครสมาชิกสำเร็จ`,
        userId: user.id,
      },
    });
    return {
      message: `สมัครสมาชิกสำเร็จแล้ว คุณ${firstNameTh} ${lastNameTh}!`,
    };
  }
}
