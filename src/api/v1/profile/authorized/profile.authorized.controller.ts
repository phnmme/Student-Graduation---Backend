import { getJwtSecret } from "../../../../utils/jwtSecret";
import { Elysia, t } from "elysia";
import { profileAuthorizedService } from "./profile.authorized.service";
import { jwt } from "@elysiajs/jwt";

const service = new profileAuthorizedService();

export const profileAuthorizedController = new Elysia()
  .use(jwt({
    name: "jwt",
    secret: getJwtSecret(),
  }))
  .group("/api/v1/profile/authorized", (app) => {
    app.get("/getprofile", ({ set, headers, jwt }) =>
      service.getProfile(jwt, set, headers)
    );

    app.put("/updateprofile", ({ body, set, headers, jwt }) =>
      service.updateProfile(body, jwt, set, headers), {
      body: t.Object({
        fullname: t.Optional(t.String()),
        studentCode: t.Optional(t.String()),
        department: t.Optional(t.String()),
        gradYear: t.Optional(t.Number()),
        jobField: t.Optional(t.String()),
        companyName: t.Optional(t.Union([t.String({ maxLength: 150 }), t.Null()])),
        jobStartYear: t.Optional(t.Union([t.Number({ minimum: 1900, maximum: 3000 }), t.Null()])),
        continuedFromCoop: t.Optional(t.Boolean()),
        employmentSector: t.Optional(t.Union([
          t.Literal("PRIVATE"),
          t.Literal("GOVERNMENT"),
          t.Literal("STATE_ENTERPRISE"),
          t.Literal("SELF_EMPLOYED"),
          t.Null(),
        ])),
        continued_from_coop: t.Optional(t.Boolean()),
        employment_sector: t.Optional(t.Union([
          t.Literal("PRIVATE"),
          t.Literal("GOVERNMENT"),
          t.Literal("STATE_ENTERPRISE"),
          t.Literal("SELF_EMPLOYED"),
          t.Null(),
        ])),
      }),
    });

    app.post("/job-history", ({ body, set, headers, jwt }) =>
      service.addJobHistory(body, jwt, set, headers), {
      body: t.Object({
        jobTitle: t.String({ minLength: 1, maxLength: 150 }),
        companyName: t.String({ minLength: 1, maxLength: 150 }),
        startYear: t.Number({ minimum: 1900, maximum: 3000 }),
        description: t.Optional(t.String({ maxLength: 1000 })),
      }),
    });

    app.delete("/job-history/:id", ({ params, set, headers, jwt }) =>
      service.deleteJobHistory(Number(params.id), jwt, set, headers), {
      params: t.Object({ id: t.Numeric() }),
    });

    return app;
  });
