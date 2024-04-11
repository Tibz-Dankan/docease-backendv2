import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/error";
import { asyncHandler } from "../utils/asyncHandler";
import { PrismaClient } from "@prisma/client";
import { notification } from "../utils/notification";
import { TVideoConference } from "../types/conferencing";
import { TUser } from "../types/user";

const prisma = new PrismaClient();
const VideoConference = prisma.videoConference;

export const getVideoConference = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const hostId = req.query.hostId as string;
    const attendeeId = req.query.attendeeId as string;

    if (!hostId || !attendeeId) {
      return next(
        new AppError("Please provide both hostId and attendeeId", 400)
      );
    }

    const conferences = await VideoConference.findMany({
      where: {
        hostId: { equals: hostId },
        attendeeId: { equals: attendeeId },
      },
      take: 1,
      orderBy: { createdAt: "desc" },
      include: {
        Host: {
          select: {
            userId: true,
            firstName: true,
            lastName: true,
            gender: true,
            role: true,
            imageUrl: true,
          },
        },
        Attendee: {
          select: {
            userId: true,
            firstName: true,
            lastName: true,
            gender: true,
            role: true,
            imageUrl: true,
          },
        },
      },
    });

    const conference = conferences[0];
    const isItLessThanOneDayFromConfCreation: boolean =
      new Date(conferences[0]!.createdAt) <
      new Date(Date.now() + 1000 * 60 * 30);

    if (isItLessThanOneDayFromConfCreation) {
      const userId = res.locals.user.userId;

      const sendToUserId =
        userId === conference.hostId
          ? conference.attendeeId
          : conference.hostId;

      const title =
        userId === conference.hostId
          ? conference.Attendee.role === "doctor"
            ? "Dr."
            : "Pt."
          : conference.Host.role === "doctor"
          ? "Dr."
          : "Pt.";

      const name =
        userId === conference.hostId
          ? `${title} ${conference.Attendee.firstName} ${conference.Attendee.lastName}`
          : `${title}  ${conference.Host.firstName} ${conference.Host.lastName}`;

      const message = `Please Join a Call with ${name}`;

      notification.emitConfNotificationEvent({
        userId: sendToUserId,
        message: message,
        videoConferenceId: conference.videoConferenceId,
      });

      res.status(200).json({
        status: "success",
        message: "fetched conference",
        data: { conference: conference },
      });
      // TODO:use both real time communication and push notifications
      return;
    }

    const newConference = await VideoConference.create({
      data: { hostId: hostId, attendeeId: attendeeId },
      select: {
        videoConferenceId: true,
        hostId: true,
        attendeeId: true,
        createdAt: true,
        updatedAt: true,
        Host: {
          select: {
            userId: true,
            firstName: true,
            lastName: true,
            gender: true,
            role: true,
            imageUrl: true,
          },
        },
        Attendee: {
          select: {
            userId: true,
            firstName: true,
            lastName: true,
            gender: true,
            role: true,
            imageUrl: true,
          },
        },
      },
    });
    // TODO:trigger event to alert the user to enter the meeting

    const userId = res.locals.user.userId;
    const sendToUserId =
      userId === newConference.hostId
        ? newConference.attendeeId
        : newConference.hostId;

    const title =
      userId === newConference.hostId
        ? newConference.Attendee.role === "doctor"
          ? "Dr."
          : "Pt."
        : newConference.Host.role === "doctor"
        ? "Dr."
        : "Pt.";

    const name =
      userId === newConference.hostId
        ? `${title} ${newConference.Attendee.firstName} ${newConference.Attendee.lastName}`
        : `${title} ${newConference.Host.firstName} ${newConference.Host.lastName}`;

    const message = `Join Video Call with ${name}`;
    notification.emitConfNotificationEvent({
      userId: sendToUserId,
      message: message,
      videoConferenceId: newConference.videoConferenceId,
    });

    res.status(201).json({
      status: "success",
      message: "conference created",
      data: { conference: newConference },
    });
    // TODO:to implement push notifications for alerting joining
  }
);

export const getVideoConferenceById = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const videoConferenceId = req.params.videoConferenceId as string;

    if (!videoConferenceId) {
      return next(new AppError("Please provide videoConferenceId", 400));
    }

    const conference = await VideoConference.findFirst({
      where: {
        videoConferenceId: { equals: videoConferenceId },
      },
      include: {
        Host: {
          select: {
            userId: true,
            firstName: true,
            lastName: true,
            gender: true,
            role: true,
            imageUrl: true,
          },
        },
        Attendee: {
          select: {
            userId: true,
            firstName: true,
            lastName: true,
            gender: true,
            role: true,
            imageUrl: true,
          },
        },
      },
    });

    const userId: string = res.locals.user.userId;

    const isAllowedUserId: boolean =
      userId === conference?.hostId || userId === conference?.attendeeId;

    if (!isAllowedUserId) {
      return next(new AppError("Not allowed to join conference", 403));
    }

    if (!conference) {
      return next(new AppError("Please provide videoConferenceId", 404));
    }

    res.status(201).json({
      status: "success",
      message: "conference fetched successfully",
      data: { conference: conference },
    });
  }
);

export const joinVideoConference = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const videoConferenceId = req.body.videoConferenceId as string;

    if (!videoConferenceId) {
      return next(new AppError("Please provide conferenceId", 400));
    }
    const conferences = await VideoConference.findMany({
      where: {
        videoConferenceId: { equals: videoConferenceId },
      },
      take: 1,
      orderBy: { createdAt: "desc" },
      include: {
        Host: {
          select: {
            userId: true,
            firstName: true,
            lastName: true,
            gender: true,
            role: true,
            imageUrl: true,
          },
        },
        Attendee: {
          select: {
            userId: true,
            firstName: true,
            lastName: true,
            gender: true,
            role: true,
            imageUrl: true,
          },
        },
      },
    });

    if (!conferences) {
      return next(new AppError("No conference of provided Id was found", 404));
    }

    // const userId = res.locals.user.userId;

    // const sendToUserId =
    //   userId === conference.hostId ? conference.attendeeId : conference.hostId;

    // notification.emitConfNotificationEvent({
    //   userId: sendToUserId,
    //   message: "confconnected",
    //   videoConferenceId: videoConferenceId,
    //   peerId: peerId,
    // });

    res.status(200).json({
      status: "success",
      message: "Joined conference successfully",
      data: { conference: conferences[0] },
    });
  }
);

//roomId is the videoConferencingId
export const videoConferencingController = (io: any) => {
  io.on("connection", (socket: any) => {
    console.log("socket id: " + socket.id);

    socket.on(
      "join-room",
      (roomId: string, peerId: string, peerUser: TUser) => {
        const userId = peerUser.userId;

        setTimeout(() => {
          socket.to(roomId).emit("user-connected", peerId);

          // notification.emitConfNotificationEvent({
          //   userId: userId,
          //   videoConferenceId: roomId,
          // });
        }, 1000);

        socket.on("message", (message: string) => {
          io.to(roomId).emit("createMessage", message, userId);
        });
      }
    );
  });
};

// TODO: to switch back to web sockets for videoConf
