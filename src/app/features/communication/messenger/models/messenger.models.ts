export type ConversationType = 'Direct' | 'Group';
export type ConversationMemberRole = 'Member' | 'Owner';
export type MessageType = 'Text' | 'System';

export interface ChatMember {
  employeeId: number;
  fullName: string | null;
  positionName: string | null;
  departmentName: string | null;
  unitName: string | null;
  hasPhoto: boolean;
  role: ConversationMemberRole;
  lastReadMessageId: number | null;
}

export interface ChatContact {
  employeeId: number;
  fullName: string;
  positionName: string | null;
  departmentName: string | null;
  unitName: string | null;
  hasPhoto: boolean;
}

export interface MessagePreview {
  id: number;
  authorId: number | null;
  authorFullName: string | null;
  text: string | null;
  isDeleted: boolean;
}

export interface ChatMessage {
  id: number;
  conversationId: number;
  type: MessageType;
  /** Null for a deleted message. */
  text: string | null;
  authorId: number | null;
  authorFullName: string | null;
  createdAt: string;
  editedAt: string | null;
  isDeleted: boolean;
  clientMessageId: string | null;
  replyTo: MessagePreview | null;
}

/** A message shown before the server saved it. */
export type DeliveryState = 'sending' | 'failed';

export interface DisplayMessage extends ChatMessage {
  /** Set while the message isn't saved yet. */
  delivery?: DeliveryState;
}

export interface Conversation {
  id: number;
  type: ConversationType;
  /** Group name, or the other member's name; null when they are no longer available. */
  title: string | null;
  interlocutor: ChatMember | null;
  members: ChatMember[];
  lastMessage: ChatMessage | null;
  lastActivityAt: string;
  unreadCount: number;
  readByOthersUpToMessageId: number | null;
  myRole: ConversationMemberRole | 'None';
  canWrite: boolean;
}

export interface MessengerUnreadCount {
  conversations: number;
  messages: number;
}

export interface ConversationRead {
  conversationId: number;
  employeeId: number;
  lastReadMessageId: number;
}

export interface Typing {
  conversationId: number;
  employeeId: number;
  fullName: string;
}
