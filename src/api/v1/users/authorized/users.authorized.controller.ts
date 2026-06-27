// src/api/v1/user/users.authorized.controller.ts

import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { UserService } from "./users.authorized.service";

const service = new UserService();

const jwtPlugin = jwt({
  name: "jwt",
  secret: process.env.JWT_SECRET ?? "your-secret-key",
});

export const userController = new Elysia()
  .use(jwtPlugin)
  .group("/api/v1/user/authorized", (app) =>
    app
      // GET /api/v1/user/authorized/users?search=&role=&hasProfile=&page=&limit=
      .get("/users", ({ jwt, set, headers, query }) =>
        service.getUsers(query, jwt, set, headers)
      )

      // GET /api/v1/user/authorized/users/:id
      .get("/users/:id", ({ jwt, set, headers, params }) =>
        service.getUserById(Number(params.id), jwt, set, headers)
      )

      // DELETE /api/v1/user/authorized/users/:id
      .delete("/users/:id", ({ jwt, set, headers, params }) =>
        service.deleteUser(Number(params.id), jwt, set, headers)
      )

      // POST /api/v1/user/authorized/users/:id/reset-password
      .post("/users/:id/reset-password", ({ jwt, set, headers, params }) =>
        service.resetPassword(Number(params.id), jwt, set, headers)
      )
  );
