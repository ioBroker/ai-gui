/**
 * As much Markdown as an answer of the assistant is made of, and not a line more.
 *
 * A model writes `**Schalter-Widget**`, a datapoint in backticks and a list of three dashes, and a chat that
 * shows that as it stands makes the reader do the parsing. The whole of Markdown is not needed for it -
 * images, footnotes and raw HTML never arrive - so this is a parser of the handful of things that do:
 * paragraphs, headings, lists, quotes, tables, fenced code, and inside a line bold, italic, code and links.
 *
 * It parses to data, not to HTML. What comes back from a model is text of unknown origin, and a renderer
 * that builds elements out of these pieces cannot be talked into anything, while one that hands a string to
 * `dangerouslySetInnerHTML` has to be guarded forever.
 *
 * An answer arrives a token at a time, so every unfinished thing has to read as itself: a `**` without its
 * closing pair is two asterisks, a fence that has not been closed yet is a code block to the end of what
 * there is. Nothing here throws, and nothing waits for a terminator that may never come.
 */
/** A piece of a line */
export type Span = {
    kind: 'text' | 'bold' | 'italic' | 'code';
    text: string;
} | {
    kind: 'link';
    text: string;
    href: string;
};
/** A piece of an answer */
export type Block = {
    kind: 'paragraph';
    text: string;
} | {
    kind: 'heading';
    level: number;
    text: string;
} | {
    kind: 'list';
    ordered: boolean;
    items: string[];
} | {
    kind: 'code';
    text: string;
    language: string;
} | {
    kind: 'quote';
    text: string;
} | {
    kind: 'table';
    header: string[];
    rows: string[][];
};
/**
 * One line of Markdown, as the pieces it is made of.
 *
 * The markers are read left to right, and one that does not close is kept as the characters it is - which is
 * what a half-written answer consists of. Nothing nests: `**bold with `code` in it**` becomes bold, then
 * code, then bold again, which reads the same and costs a tenth of the code.
 *
 * @param text - the line, as the model wrote it
 */
export declare function inlineSpans(text: string): Span[];
/**
 * An answer, as the blocks it is made of.
 *
 * Inside a paragraph the line breaks are kept. In Markdown a single break is a space, but this is a chat:
 * somebody who writes two lines means two lines, and a model writing an address under a name means it too.
 *
 * @param source - the answer, as far as it has arrived
 */
export declare function markdownBlocks(source: string): Block[];
