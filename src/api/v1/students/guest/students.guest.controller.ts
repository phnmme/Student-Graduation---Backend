import { Elysia } from "elysia";
import { studentsGuestService } from "./students.guest.service";

const service = new studentsGuestService();

export const studentsGuestController = new Elysia().group(
  "/api/v1/students/guest",
  (app) => {
    app.get("/getallyear", () => service.getAllYear());

    app.get("/getall", () => service.getAllStudentsGrouped());

    app.get("/getstudentbyyear", ({ query }) =>
      service.getStudentByYear(
        parseInt(query.year),
        query.search ?? "",
        parseInt(query.skip) || 0,
        parseInt(query.take) || 10
      )
    );

    return app;
  }
);
