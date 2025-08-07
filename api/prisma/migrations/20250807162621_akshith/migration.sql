-- CreateEnum
CREATE TYPE "public"."SubmissionStatus" AS ENUM ('Queued', 'Successful', 'Error');

-- CreateTable
CREATE TABLE "public"."Language" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "compileCommand" TEXT NOT NULL DEFAULT '',
    "executionCommand" TEXT NOT NULL DEFAULT '',
    "testCommand" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Language_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Problem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Problem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Submission" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "source_code" TEXT NOT NULL,
    "mainFuncName" TEXT NOT NULL DEFAULT 'main',
    "stdin" TEXT[] DEFAULT ARRAY['']::TEXT[],
    "stdout" TEXT NOT NULL DEFAULT '',
    "language_id" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "executionContainerId" TEXT NOT NULL DEFAULT '',
    "status" "public"."SubmissionStatus" NOT NULL DEFAULT 'Queued',
    "testCasesPassed" TEXT[],
    "runtime" DOUBLE PRECISION,
    "memoryUsage" DOUBLE PRECISION,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "public"."User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- AddForeignKey
ALTER TABLE "public"."Submission" ADD CONSTRAINT "Submission_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "public"."Problem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Submission" ADD CONSTRAINT "Submission_language_id_fkey" FOREIGN KEY ("language_id") REFERENCES "public"."Language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Submission" ADD CONSTRAINT "Submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
