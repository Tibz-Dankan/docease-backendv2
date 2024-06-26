import { TUser } from "./user";

export type TFile = {
  url: string;
  path: string;
  type: string;
};

export type TChatMessage = {
  messageId?: string;
  chatRoomId: string;
  senderId: string;
  recipientId: string;
  message: string;
  isRead: boolean;
  isDelivered: boolean;
  createdAt: Date;
  updatedAt?: Date;
};

export type TChatExtended = TChatMessage & {
  sender: TUser;
  recipient: TUser;
};

export type TChatRecipient = TUser & {
  messages: TChatMessage[];
};

export type TChatRecipientExtended = TUser & {
  sender: TChatMessage[];
  recipient: TChatMessage[];
};

export type TRecipient = {
  recipient?: TChatRecipientExtended;
  sender?: TChatRecipientExtended;
};
