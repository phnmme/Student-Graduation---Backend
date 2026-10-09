CREATE TABLE "EmploymentHistory" (
    "id" SERIAL NOT NULL,
    "profileId" INTEGER NOT NULL,
    "jobTitle" VARCHAR(150) NOT NULL,
    "companyName" VARCHAR(150) NOT NULL,
    "startYear" INTEGER NOT NULL,
    "endYear" INTEGER,
    "description" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmploymentHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EmploymentHistory_profileId_idx" ON "EmploymentHistory"("profileId");
ALTER TABLE "EmploymentHistory"
ADD CONSTRAINT "EmploymentHistory_profileId_fkey"
FOREIGN KEY ("profileId") REFERENCES "StudentProfile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
