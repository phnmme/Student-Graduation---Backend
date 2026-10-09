// src/api/v1/log/log.controller.ts

import { getJwtSecret } from "../../../../utils/jwtSecret";
import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { logService } from "./logs.authorized.service";

const service = new logService();

export const logController = new Elysia()
  .use(
    jwt({
      name: "jwt",
      secret: getJwtSecret(),
    })
  )
  .group("/api/v1/log/authorized", (app) => {
    // GET /api/v1/log/logs?search=&action=&userId=&page=1&limit=20
    app.get("/logs", ({ jwt, set, headers, query }) =>
      service.getLogs(query, jwt, set, headers)
    );

    // GET /api/v1/log/logs/actions — รายชื่อ action ทั้งหมดสำหรับ dropdown filter
    app.get("/logs/actions", ({ jwt, set, headers }) =>
      service.getLogActions(jwt, set, headers)
    );

    // DELETE /api/v1/log/logs/:id
    app.delete("/logs/:id", ({ jwt, set, headers, params }) =>
      service.deleteLog(Number(params.id), jwt, set, headers)
    );

    return app;
  });
