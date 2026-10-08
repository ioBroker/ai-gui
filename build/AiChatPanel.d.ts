import React from 'react';
import type { AiChatMessage, UseAiChat } from './useAiChat';
export interface AiChatPanelProps {
    /** What `useAiChat` returned */
    chat: UseAiChat;
    /** Heading of the panel, default "Assistant" */
    title?: string;
    /** Shown while the conversation is empty */
    intro?: React.ReactNode;
    /** Questions to start with; a click puts one into the input field */
    examples?: string[];
    /** Placeholder of the input field */
    placeholder?: string;
    /** Shown when no provider is configured - say where the key goes in this adapter */
    unconfiguredText?: string;
    /** Shown when the adapter does not answer */
    unreachableText?: string;
    /** More buttons in the head of the panel, before the clear button */
    headerActions?: React.ReactNode;
    /** Something to show under an answer, e.g. "insert this code" */
    renderMessageExtra?: (message: AiChatMessage) => React.ReactNode;
    /** A link in an answer was clicked, see `MarkdownText` */
    onLink?: (href: string) => boolean | void;
    /** Without it the panel has no close button */
    onClose?: () => void;
}
/**
 * The assistant, as a column of an editor.
 *
 * A chat, and under every answer the list of what it actually did. That list is the point: an
 * assistant that changes something has to say what it changed, in the words of the thing it changed,
 * or nobody can tell an error from a misunderstanding.
 *
 * @param props the chat and the texts of the editor
 */
export default function AiChatPanel(props: AiChatPanelProps): React.JSX.Element;
