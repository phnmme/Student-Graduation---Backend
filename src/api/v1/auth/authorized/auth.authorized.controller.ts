//

import { getJwtSecret } from "../../../../utils/jwtSecret";
import { Elysia } from "elysia";
import { authAuthorizedService } from "./auth.authorized.service";
import { jwt } from "@elysiajs/jwt";

const service = new authAuthorizedService();

export const authAuthorizedController = new Elysia()
  .use(
    jwt({
      name: "jwt",
      secret: getJwtSecret(),
    })
  )
  .group("/api/v1/auth/authorized", (app) => {
    app.get("/me", ({ jwt, set, headers }) => service.getMe(jwt, set, headers));
    app.get("/verify/:page", ({ jwt, set, params, headers }) =>
      service.verifyToken(params.page, jwt, set, headers)
    );

    return app;
  });
