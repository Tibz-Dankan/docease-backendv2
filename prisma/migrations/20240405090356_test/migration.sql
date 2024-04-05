-- CreateTable
CREATE TABLE "_chat_mates" (
    "chatMateId" TEXT NOT NULL,
    "senderChatMateId" TEXT NOT NULL,
    "recipientChatMateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "_chat_mates_pkey" PRIMARY KEY ("chatMateId")
);

-- CreateIndex
CREATE INDEX "_chat_mates_chatMateId_idx" ON "_chat_mates"("chatMateId");

-- CreateIndex
CREATE INDEX "_chat_mates_senderChatMateId_idx" ON "_chat_mates"("senderChatMateId");

-- CreateIndex
CREATE INDEX "_chat_mates_recipientChatMateId_idx" ON "_chat_mates"("recipientChatMateId");

-- AddForeignKey
ALTER TABLE "_chat_mates" ADD CONSTRAINT "_chat_mates_senderChatMateId_fkey" FOREIGN KEY ("senderChatMateId") REFERENCES "_users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_chat_mates" ADD CONSTRAINT "_chat_mates_recipientChatMateId_fkey" FOREIGN KEY ("recipientChatMateId") REFERENCES "_users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
