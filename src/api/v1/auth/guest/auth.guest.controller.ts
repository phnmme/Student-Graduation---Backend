import { getJwtSecret } from "../../../../utils/jwtSecret";
import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { AuthGuestService } from "./auth.guest.service";

const service = new AuthGuestService();

export const authGuestController = new Elysia()
  .use(
    jwt({
      name: "jwt",
      secret: getJwtSecret(),
    })
  )
  .group("/api/v1/auth/guest", (app) => {
    app.post("/login", ({ body, jwt, set }) => service.login(body, jwt, set), {
      body: t.Object({
        email: t.String({ format: "email", maxLength: 254 }),
        password: t.String({ maxLength: 128 }),
      }),
    });
    app.post("/register", ({ body, set }) => service.register(body, set), {
      body: t.Object({
        email: t.String({ format: "email", maxLength: 254 }),
        password: t.String({ minLength: 8, maxLength: 128 }),
        confirmPassword: t.String({ minLength: 8, maxLength: 128 }),
        studentCode: t.String({ minLength: 1, maxLength: 32 }),
        firstNameTh: t.String({ minLength: 1, maxLength: 100 }),
        lastNameTh: t.String({ minLength: 1, maxLength: 100 }),
        phoneNumber: t.String({ minLength: 3, maxLength: 30 }),
        entryYear: t.Number({ minimum: 2000, maximum: 3000 }),
      }),
    });

    return app;
  });
