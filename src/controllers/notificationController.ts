import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/error";
import { asyncHandler } from "../utils/asyncHandler";
import { notification } from "../utils/notification";
import { PrismaClient } from "@prisma/client";
import { TNotification } from "../types/notification";

const prisma = new PrismaClient();
const Notification = prisma.notification;
const Device = prisma.device;

const saveNotification = async (notificationMsg: TNotification) => {
  await Notification.create({
    data: {
      userId: notificationMsg.userId,
      message: notificationMsg.message,
    },
  });
};

const clientResponseMap = new Map<string, Response>();

const sendSSENotificationToOneClient = async (
  userId: string,
  message: string
) => {
  const res = clientResponseMap.get(userId);
  if (!res) return;

  res.write(`data: ${JSON.stringify({ message, userId })}\n\n`);
};

const sendPushNotification = async (notificationMsg: TNotification) => {
  // TODO: to add logic of only sending push notification when user is offline
  if (!notificationMsg.userId) return;
  const devices = await Device.findMany({
    where: { userId: notificationMsg.userId },
  });
  if (!devices[0]) return;

  devices.map(async (device) => {
    if (device.isDisable) return;

    await notification.sendPushNotification({
      userId: notificationMsg.userId,
      message: notificationMsg.message,
      deviceToken: device.deviceToken,
      title: notificationMsg.title,
      body: notificationMsg.body,
    });
  });
};

export const getLiveNotifications = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.status(200);

    const userId = res.locals.user.userId as string;
    if (!userId) return next(new AppError("Please provide userId", 400));

    clientResponseMap.set(userId, res);

    res.write(
      `data: ${JSON.stringify({ message: "warmup", userId: userId })}\n\n`
    );

    setInterval(() => {
      res.write(
        `data: ${JSON.stringify({ message: "heartbeat", userId: userId })}\n\n`
      );
    }, 30000);

    notification
      .listenNotificationEvent()
      .on("notification", (notificationMsg: TNotification) => {
        saveNotification(notificationMsg);

        if (notificationMsg.userId !== userId) return;
        sendSSENotificationToOneClient(
          notificationMsg.userId,
          notificationMsg.message
        );

        //sending push notification
        sendPushNotification(notificationMsg);
      });

    req.on("close", () => {
      clientResponseMap.delete(userId);
    });
  }
);
