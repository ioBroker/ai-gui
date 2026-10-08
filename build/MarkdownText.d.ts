import React from 'react';
export interface MarkdownTextProps {
    /** The answer, as far as it has arrived */
    text: string;
    /**
     * A link was clicked. Without it, an address inside the application (`#tab-instances`) is followed in
     * the same window and every other one opens in a new tab. Return `true` when the click was handled
     */
    onLink?: (href: string) => boolean | void;
}
/**
 * The answer of the assistant, as what it was written as.
 *
 * A model answers in Markdown whether it is asked to or not, and a chat that shows `**Switch widget**` with
 * its asterisks makes the reader do the parsing. The parsing is in `markdown.ts`; this builds the elements -
 * no HTML string anywhere, so text from a model cannot become markup of its own.
 *
 * @param props - the answer, as far as it has arrived
 */
export default function MarkdownText(props: MarkdownTextProps): React.JSX.Element;
