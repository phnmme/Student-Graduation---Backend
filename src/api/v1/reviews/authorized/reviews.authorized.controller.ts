// src/api/v1/review/reviews.authorized.controller.ts

import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { ReviewService } from "./reviews.authorized.service";

const reviewService = new ReviewService();

const ReviewStatusSchema = t.Union([
  t.Literal("pending"),
  t.Literal("approved"),
  t.Literal("rejected"),
]);

export const reviewController = new Elysia()
  .use(
    jwt({
      name: "jwt",
      secret: process.env.JWT_SECRET || "your-secret-key",
    })
  )
  .group("/api/v1/review/authorized", (app) =>
    app
      // GET /api/v1/review/authorized/reviews
      .get(
        "/reviews",
        ({ jwt, set, headers, query }) =>
          reviewService.getReviews(query, jwt, set, headers),
        {
          query: t.Object({
            status: t.Optional(t.String()),
            search: t.Optional(t.String()),
            jobField: t.Optional(t.String()),
            page: t.Optional(t.String()),
            limit: t.Optional(t.String()),
          }),
        }
      )

      // GET /api/v1/review/authorized/reviews/jobfields
      .get("/reviews/jobfields", ({ jwt, set, headers }) =>
        reviewService.getJobFields(jwt, set, headers)
      )

      // GET /api/v1/review/authorized/reviews/:id
      .get("/reviews/:id", ({ jwt, set, headers, params }) =>
        reviewService.getReviewById(Number(params.id), jwt, set, headers)
      )

      // POST /api/v1/review/authorized/reviews
      .post(
        "/reviews",
        ({ jwt, set, headers, body }) =>
          reviewService.createReview(body, jwt, set, headers),
        {
          body: t.Object({
            title: t.String({ minLength: 1 }),
            description: t.String({ minLength: 1 }),
            jobField: t.Optional(t.String()),
          }),
        }
      )

      // PATCH /api/v1/review/authorized/reviews/:id/status
      .patch(
        "/reviews/:id/status",
        ({ jwt, set, headers, params, body }) =>
          reviewService.updateReviewStatus(
            Number(params.id),
            body,
            jwt,
            set,
            headers
          ),
        {
          body: t.Object({ status: ReviewStatusSchema }),
        }
      )

      // DELETE /api/v1/review/authorized/reviews/:id
      .delete("/reviews/:id", ({ jwt, set, headers, params }) =>
        reviewService.deleteReview(Number(params.id), jwt, set, headers)
      )
  );
