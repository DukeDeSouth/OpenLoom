-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "KeyType" AS ENUM ('PERMANENT', 'SINGLE_USE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "title" TEXT NOT NULL DEFAULT 'My Channel',
    "description" TEXT,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC',
    "order" INTEGER NOT NULL DEFAULT 0,
    "thumbKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "status" "VideoStatus" NOT NULL DEFAULT 'UPLOADING',
    "duration" INTEGER,
    "screenKey" TEXT,
    "cameraKey" TEXT,
    "micKey" TEXT,
    "outputKey" TEXT,
    "thumbKey" TEXT,
    "subtitleKey" TEXT,
    "views" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL,
    "sectionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Segment" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "start" DOUBLE PRECISION NOT NULL,
    "end" DOUBLE PRECISION NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "Segment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessKey" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "type" "KeyType" NOT NULL,
    "label" TEXT,
    "fingerprint" TEXT,
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "usedBy" TEXT,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AccessKey_token_key" ON "AccessKey"("token");

-- CreateIndex
CREATE UNIQUE INDEX "InviteCode_code_key" ON "InviteCode"("code");

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Segment" ADD CONSTRAINT "Segment_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessKey" ADD CONSTRAINT "AccessKey_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;
