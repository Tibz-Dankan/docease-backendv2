import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/error";
import { asyncHandler } from "../utils/asyncHandler";
import { PrismaClient } from "@prisma/client";
import { Socket } from "socket.io";
import { notification } from "../utils/notification";
import {
  TChatExtended,
  TChatMessage,
  TChatRecipient,
  TRecipient,
} from "../types/chat";
import { TPushNotificationTitleEnum } from "../types/notification";

const prisma = new PrismaClient();
const Chat = prisma.chat;
const ChatMate = prisma.chatMate;
const User = prisma.user;

const createOrUpdateChatMate = async (
  senderId: string,
  recipientId: string
) => {
  let chatMate: any = {};

  chatMate = await ChatMate.findFirst({
    where: {
      AND: [
        { chatMateSenderId: senderId },
        { chatMateRecipientId: recipientId },
      ],
    },
  });

  if (!chatMate?.chatMateId) {
    chatMate = await ChatMate.findFirst({
      where: {
        AND: [
          { chatMateSenderId: recipientId },
          { chatMateRecipientId: senderId },
        ],
      },
    });
  }

  if (!chatMate?.chatMateId) {
    await ChatMate.create({
      data: {
        chatMateSenderId: senderId,
        chatMateRecipientId: recipientId,
        createdAt: new Date(Date.now()).toISOString(),
      },
    });

    return;
  }

  const isChatMateSender = chatMate?.chatMateSenderId === senderId;
  const isChatMateRecipient = chatMate?.chatMateRecipientId === recipientId;

  const chatMateSenderId = isChatMateSender ? senderId : recipientId;
  const chatMateRecipientId = isChatMateRecipient ? recipientId : senderId;

  await ChatMate.update({
    where: { chatMateId: chatMate.chatMateId },
    data: {
      chatMateSenderId: chatMateSenderId,
      chatMateRecipientId: chatMateRecipientId,
    },
  });
};

export const postChat = asyncHandler(async (req, res, next) => {
  if (req.body.senderId === req.body.recipientId) {
    return next(new AppError("You can't message your self", 400));
  }

  const chatMessage = await Chat.create({
    data: req.body,
    select: {
      messageId: true,
      senderId: true,
      recipientId: true,
      chatRoomId: true,
      message: true,
      isDelivered: true,
      isRead: true,
      createdAt: true,
      updatedAt: true,
      sender: {
        select: {
          firstName: true,
          lastName: true,
          role: true,
        },
      },
    },
  });

  const title = chatMessage.sender.role === "doctor" ? "Dr." : "Pt.";
  const recipientName = `${title}${chatMessage.sender.firstName} ${chatMessage.sender.lastName}`;
  const message = `New Chat Message: You have received a new message
                   from ${recipientName}. Please check your inbox to
                   respond promptly. Thank you.`;
  // const message = `New Chat Message: You have received a new message
  //                  from ${recipientName}.`;

  // notification.emitChatEvent(chatMessage);
  notification.emitChatEvent({
    messageId: chatMessage.messageId,
    senderId: chatMessage.senderId,
    recipientId: chatMessage.recipientId,
    chatRoomId: chatMessage.chatRoomId,
    message: chatMessage.message,
    isDelivered: chatMessage.isDelivered,
    isRead: chatMessage.isRead,
    createdAt: chatMessage.createdAt,
    updatedAt: chatMessage.updatedAt,
  });

  // Emit notification event
  notification.emitNotificationEvent({
    userId: chatMessage.recipientId,
    message: message,
    title: TPushNotificationTitleEnum.MESSAGE,
    body: message,
    link: `/messages?id=${chatMessage.messageId}`,
  });

  // await createDoctorsPatient(doctorId, patientId);
  await createOrUpdateChatMate(req.body.senderId, req.body.recipientId);

  res.status(200).json({
    status: "success",
    message: "chat created",
  });
});

const chatResponseMap = new Map<string, Response>();

export const getLiveChat = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.status(200);

    const userId = res.locals.user.userId as string;
    if (!userId) return next(new AppError("Please provide userId", 400));

    chatResponseMap.set(userId, res);

    res.write(
      `data: ${JSON.stringify({ message: "warmup", userId: userId })}\n\n`
    );

    setInterval(() => {
      res.write(
        `data: ${JSON.stringify({ message: "heartbeat", userId: userId })}\n\n`
      );
    }, 30000);

    notification.registerChatListener((message: any) => {
      console.log("sending the message to respective client...");
      const recipientId: string = message.recipientId;
      const res = chatResponseMap.get(recipientId);
      if (!res) return;

      res.write(
        `data: ${JSON.stringify({
          message,
          recipientId,
        })}\n\n`
      );
    });

    req.on("close", () => {
      chatResponseMap.delete(userId);
    });
  }
);

const organizeChatRecipients = (
  currentUserId: string,
  chats: TChatExtended[]
): TChatRecipient[] => {
  const recipients: TChatRecipient[] = [];

  if (!chats[0]) return recipients;

  chats.map((chat) => {
    let recipientId: string;

    // Determine the current recipientId
    if (currentUserId === chat.recipient.userId) {
      recipientId = chat.sender.userId;
    } else {
      recipientId = chat.recipient.userId;
    }

    const recipient = recipients.find((recipient) => {
      return recipientId === recipient.userId;
    });
    if (recipient) return;

    const recipientObject: TChatRecipient = {
      userId: "",
      firstName: "",
      lastName: "",
      email: "",
      gender: "male",
      role: "patient",
      imageUrl: "",
      messages: [],
    };

    const messages: TChatMessage[] = [];

    // Capture messages and user details of current recipient
    chats.map((chat) => {
      const isRecipient: boolean = recipientId === chat.recipientId;
      const isSender: boolean = recipientId === chat.senderId;

      if (isRecipient) {
        const user = chat.recipient;
        recipientObject.userId = user.userId;
        recipientObject.firstName = user.firstName;
        recipientObject.lastName = user.lastName;
        recipientObject.email = user.email;
        recipientObject.role = user.role;
        recipientObject.gender = user.gender;
        recipientObject.imageUrl = user.imageUrl;

        messages.push({
          messageId: chat.messageId,
          chatRoomId: chat.chatRoomId,
          senderId: chat.senderId,
          recipientId: chat.recipientId,
          message: chat.message,
          isRead: chat.isRead,
          isDelivered: chat.isDelivered,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
        });
      }
      if (isSender) {
        const user = chat.sender;
        recipientObject.userId = user.userId;
        recipientObject.firstName = user.firstName;
        recipientObject.lastName = user.lastName;
        recipientObject.email = user.email;
        recipientObject.role = user.role;
        recipientObject.gender = user.gender;
        recipientObject.imageUrl = user.imageUrl;

        messages.push({
          messageId: chat.messageId,
          chatRoomId: chat.chatRoomId,
          senderId: chat.senderId,
          recipientId: chat.recipientId,
          message: chat.message,
          isRead: chat.isRead,
          isDelivered: chat.isDelivered,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
        });
      }
    });

    recipientObject.messages = messages;
    recipients.push(recipientObject);
  });

  return recipients;
};

// TODO: to revise the way of fetching chat recipient
export const getChatRecipients = asyncHandler(async (req, res, next) => {
  const userId = req.query.userId as string;

  if (!userId) return next(new AppError("No userId is provided", 400));

  // TODO: to add functionality of fetching messages based on the created at date
  const chats = (await Chat.findMany({
    where: {
      OR: [
        { senderId: { equals: userId } },
        { recipientId: { equals: userId } },
      ],
    },
    orderBy: { createdAt: "asc" },
    include: {
      sender: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          gender: true,
          imageUrl: true,
        },
      },
      recipient: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          gender: true,
          imageUrl: true,
        },
      },
    },
  })) as TChatExtended[];

  const recipients: TChatRecipient[] = organizeChatRecipients(userId, chats);

  console.log("recipients===>:::", recipients);

  res.status(200).json({
    status: "success",
    message: "Recipients fetched successfully",
    data: { recipients: recipients },
  });
});

const combineAndSortMessages = (
  recipient: TChatMessage[],
  sender: TChatMessage[]
): TChatMessage[] => {
  const combinedMessages: TChatMessage[] = [...recipient, ...sender];

  combinedMessages.sort((a, b) => {
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  return combinedMessages;
};

const organizeRecipients = (
  unSortedRecipients: TRecipient[],
  currentUserId: string
): TChatRecipient[] => {
  const recipients: TChatRecipient[] = [];

  unSortedRecipients.map((recipient) => {
    let organizedMessages: TChatMessage[] = [];

    const recipientObject: TChatRecipient = {
      userId: "",
      firstName: "",
      lastName: "",
      email: "",
      gender: "male",
      role: "patient",
      imageUrl: "",
      messages: [],
    };

    if (recipient.recipient) {
      if (recipient.recipient.userId === currentUserId) return;

      organizedMessages = combineAndSortMessages(
        recipient.recipient.recipient,
        recipient.recipient.sender
      );
      (recipientObject.userId = recipient.recipient.userId),
        (recipientObject.firstName = recipient.recipient.firstName),
        (recipientObject.lastName = recipient.recipient.lastName),
        (recipientObject.email = recipient.recipient.email),
        (recipientObject.gender = recipient.recipient.gender),
        (recipientObject.role = recipient.recipient.role),
        (recipientObject.imageUrl = recipient.recipient.imageUrl),
        (recipientObject.messages = organizedMessages);
    }

    if (recipient.sender) {
      if (recipient.sender.userId === currentUserId) return;

      organizedMessages = combineAndSortMessages(
        recipient.sender.recipient,
        recipient.sender.sender
      );
      (recipientObject.userId = recipient.sender.userId),
        (recipientObject.firstName = recipient.sender.firstName),
        (recipientObject.lastName = recipient.sender.lastName),
        (recipientObject.email = recipient.sender.email),
        (recipientObject.gender = recipient.sender.gender),
        (recipientObject.role = recipient.sender.role),
        (recipientObject.imageUrl = recipient.sender.imageUrl),
        (recipientObject.messages = organizedMessages);
    }

    recipients.push(recipientObject);
  });

  return recipients;
};

export const getRecipients = asyncHandler(async (req, res, next) => {
  const userId = req.query.userId as string;

  if (!userId) return next(new AppError("No userId is provided", 400));

  let recipients: TRecipient[] = [];

  recipients = (await ChatMate.findMany({
    where: {
      OR: [{ chatMateSenderId: userId }, { chatMateRecipientId: userId }],
    },
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: {
      recipient: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          gender: true,
          imageUrl: true,
          recipient: {
            where: { OR: [{ recipientId: userId }, { senderId: userId }] },
            orderBy: { createdAt: "asc" },
            take: -10,
          },
          sender: {
            where: { OR: [{ recipientId: userId }, { senderId: userId }] },
            orderBy: { createdAt: "asc" },
            take: -10,
          },
        },
      },
    },
  })) as TRecipient[];

  if (recipients[0].recipient?.userId === userId) {
    recipients = (await ChatMate.findMany({
      where: {
        OR: [{ chatMateSenderId: userId }, { chatMateRecipientId: userId }],
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        sender: {
          select: {
            userId: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            gender: true,
            imageUrl: true,
            recipient: {
              where: { OR: [{ recipientId: userId }, { senderId: userId }] },
              orderBy: { createdAt: "asc" },
              take: -10,
            },
            sender: {
              where: { OR: [{ recipientId: userId }, { senderId: userId }] },
              orderBy: { createdAt: "asc" },
              take: -10,
            },
          },
        },
      },
    })) as TRecipient[];
  }

  const sortedRecipients = organizeRecipients(recipients, userId);

  res.status(200).json({
    status: "success",
    message: "Recipients fetched successfully",
    data: { recipients: sortedRecipients },
  });
});

export const getMessagesByChatRoom = asyncHandler(async (req, res, next) => {
  const cursorId = req.query.cursorId as string;
  const chatRoomId = req.query.chatRoomId as string;

  if (!chatRoomId) return next(new AppError("Please provide chatRoomId", 400));
  if (!cursorId) return next(new AppError("Please provide  cursorId", 400));

  const messages = (await Chat.findMany({
    where: {
      chatRoomId: { equals: chatRoomId },
    },
    cursor: { messageId: cursorId },
    orderBy: { createdAt: "asc" },
    skip: 1,
    take: -20,
  })) as TChatMessage[];

  res.status(200).json({
    status: "success",
    message: "Messages fetched successfully",
    data: { messages: messages },
  });
});

export const markMessageAsRead = asyncHandler(async (req, res, next) => {
  const userId = req.body.userId as string;
  const createdAt = req.body.createdAt as string; //last message createdAt date

  if (!userId) return next(new AppError("Please provide userId", 400));
  if (!createdAt) {
    return next(new AppError("Please provide message createdAt date", 400));
  }

  await Chat.updateMany({
    data: { isRead: true },
    where: {
      AND: [
        { isRead: { equals: false } },
        { recipientId: { equals: userId } },
        { createdAt: { lte: new Date(createdAt).toISOString() } },
      ],
    },
  });

  res.status(200).json({
    status: "success",
    message: "Message marked as read successfully",
  });
});

export const getChatMessagesByChatRoom = asyncHandler(
  async (req, res, next) => {
    const chatRoomId = req.query.chatRoomId as string;
    console.log("chatRoomId", chatRoomId);

    if (!chatRoomId) {
      return next(new AppError("please provide chatRoomId", 400));
    }

    // const messages = await Chat.findMany({
    //   where: {
    //     OR: [
    //       { senderId: { equals: userId } },
    //       { recipientId: { equals: userId } },
    //     ],
    //   },
    // });

    // TODO: include pagination here
    const messages = await Chat.findMany({
      where: {
        chatRoomId: { equals: chatRoomId },
      },
    });

    if (!messages) {
      return next(new AppError("No chat messages yet", 404));
    }

    res.status(200).json({
      status: "success",
      message: "chat messages fetched successfully",
      data: { messages: messages },
    });
  }
);
