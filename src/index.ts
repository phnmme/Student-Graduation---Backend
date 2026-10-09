import { Elysia } from "elysia";
import { authGuestController } from "./api/v1/auth/guest/auth.guest.controller";
import { authAuthorizedController } from "./api/v1/auth/authorized/auth.authorized.controller";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { studentsGuestController } from "./api/v1/students/guest/students.guest.controller";
import { profileAuthorizedController } from "./api/v1/profile/authorized/profile.authorized.controller";
import { statisticsGuestController } from "./api/v1/statistics/guest/statistics.guest.controller";
import { adminController } from "./api/v1/admin/authorized/admin.authorized.controller";
import { logController } from "./api/v1/logs/authorized/logs.authorized.controller";
import { reviewController } from "./api/v1/reviews/authorized/reviews.authorized.controller";
import { reviewGuestController } from "./api/v1/reviews/guest/reviews.guest.controller";
import { userController } from "./api/v1/users/authorized/users.authorized.controller";

const app = new Elysia()
  .use(
    cors({
      origin: [
        "https://website-kmutnb-1n4c.vercel.app",
        "http://localhost:3000",
      ],
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    })
  )
  .use(swagger())
  .use(authGuestController)
  .use(authAuthorizedController)
  .use(studentsGuestController)
  .use(profileAuthorizedController)
  .use(statisticsGuestController)
  .use(adminController)
  .use(logController)
  .use(reviewGuestController)
  .use(reviewController)
  .use(userController)
  .listen(4000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
