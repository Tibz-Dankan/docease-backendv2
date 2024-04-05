/*
  Warnings:

  - You are about to drop the column `recipientChatMateId` on the `_chat_mates` table. All the data in the column will be lost.
  - You are about to drop the column `senderChatMateId` on the `_chat_mates` table. All the data in the column will be lost.
  - Added the required column `chatMateRecipientId` to the `_chat_mates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `chatMateSenderId` to the `_chat_mates` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "_chat_mates" DROP CONSTRAINT "_chat_mates_recipientChatMateId_fkey";

-- DropForeignKey
ALTER TABLE "_chat_mates" DROP CONSTRAINT "_chat_mates_senderChatMateId_fkey";

-- DropIndex
DROP INDEX "_chat_mates_recipientChatMateId_idx";

-- DropIndex
DROP INDEX "_chat_mates_senderChatMateId_idx";

-- AlterTable
ALTER TABLE "_chat_mates" DROP COLUMN "recipientChatMateId",
DROP COLUMN "senderChatMateId",
ADD COLUMN     "chatMateRecipientId" TEXT NOT NULL,
ADD COLUMN     "chatMateSenderId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "_chat_mates_chatMateSenderId_idx" ON "_chat_mates"("chatMateSenderId");

-- CreateIndex
CREATE INDEX "_chat_mates_chatMateRecipientId_idx" ON "_chat_mates"("chatMateRecipientId");

-- AddForeignKey
ALTER TABLE "_chat_mates" ADD CONSTRAINT "_chat_mates_chatMateSenderId_fkey" FOREIGN KEY ("chatMateSenderId") REFERENCES "_users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_chat_mates" ADD CONSTRAINT "_chat_mates_chatMateRecipientId_fkey" FOREIGN KEY ("chatMateRecipientId") REFERENCES "_users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
