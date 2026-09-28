-- AlterEnum
ALTER TYPE "NoteType" ADD VALUE 'water';

-- AlterTable
ALTER TABLE "notes" ADD COLUMN     "waterMl" INTEGER;
