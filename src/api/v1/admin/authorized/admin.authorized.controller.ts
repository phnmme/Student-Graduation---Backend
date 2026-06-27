// src/api/v1/admin/admin.authorized.controller.ts

import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { AdminAuthorizedService } from "./admin.authorized.service";

const service = new AdminAuthorizedService();

const jwtPlugin = jwt({
  name: "jwt",
  secret: process.env.JWT_SECRET ?? "your-secret-key",
});

export const adminController = new Elysia()
  .use(jwtPlugin)
  .group("/api/v1/admin/authorized", (app) =>
    app
      .get("/admins", ({ jwt, set, headers }) =>
        service.getAdmins(jwt, set, headers)
      )
      .post(
        "/admins",
        ({ jwt, set, headers, body }) =>
          service.createAdmin(body, jwt, set, headers),
        {
          body: t.Object({ email: t.String({ format: "email" }) }),
        }
      )
      .delete("/admins/:id", ({ jwt, set, headers, params }) =>
        service.deleteAdmin(Number(params.id), jwt, set, headers)
      )
  );
