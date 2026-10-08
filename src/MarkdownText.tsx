import React from 'react';

import { Box, Link } from '@mui/material';

import { inlineSpans, markdownBlocks, type Block, type Span } from './markdown';

export interface MarkdownTextProps {
    /** The answer, as far as it has arrived */
    text: string;
    /**
     * A link was clicked. Without it, an address inside the application (`#tab-instances`) is followed in
     * the same window and every other one opens in a new tab. Return `true` when the click was handled
     */
    onLink?: (href: string) => boolean | void;
}

/** Whether an address leads somewhere inside the application rather than out of it */
function isInternal(href: string): boolean {
    return href.startsWith('#') || href.startsWith('/#');
}

/** A word in backticks, and a block of code: both stand out by their background, not by a frame */
const CODE_BACKGROUND = 'action.selected';

/** The size of a heading, by its level; a panel this narrow has no room for a third size above the text */
const HEADING_SIZE = [15.5, 14.5, 14];

/** The pieces of one line, as elements */
function renderSpans(text: string, onLink?: MarkdownTextProps['onLink']): React.ReactNode[] {
    return inlineSpans(text).map((span: Span, index: number) => {
        switch (span.kind) {
            case 'bold':
                return <strong key={index}>{span.text}</strong>;

            case 'italic':
                return <em key={index}>{span.text}</em>;

            case 'code':
                return (
                    <Box
                        key={index}
                        component="code"
                        sx={{
                            px: 0.5,
                            borderRadius: 0.75,
                            bgcolor: CODE_BACKGROUND,
                            fontFamily: 'monospace',
                            fontSize: '0.92em',
                        }}
                    >
                        {span.text}
                    </Box>
                );

            case 'link':
                return (
                    <Link
                        key={index}
                        href={span.href}
                        target={isInternal(span.href) ? undefined : '_blank'}
                        rel={isInternal(span.href) ? undefined : 'noopener noreferrer'}
                        color="inherit"
                        sx={{ textDecorationThickness: 1 }}
                        onClick={event => {
                            if (onLink?.(span.href)) {
                                event.preventDefault();
                            }
                        }}
                    >
                        {span.text}
                    </Link>
                );

            default:
                return <React.Fragment key={index}>{span.text}</React.Fragment>;
        }
    });
}

/** One block, as an element */
function renderBlock(block: Block, index: number, onLink?: MarkdownTextProps['onLink']): React.JSX.Element {
    const spans = (text: string): React.ReactNode[] => renderSpans(text, onLink);
    switch (block.kind) {
        case 'table':
            return (
                <Box
                    key={index}
                    sx={{ overflowX: 'auto' }}
                >
                    <Box
                        component="table"
                        sx={{
                            borderCollapse: 'collapse',
                            fontSize: '0.95em',
                            '& th, & td': {
                                border: 1,
                                borderColor: 'divider',
                                px: 0.75,
                                py: 0.25,
                                textAlign: 'left',
                                verticalAlign: 'top',
                            },
                            '& th': { bgcolor: CODE_BACKGROUND, fontWeight: 600 },
                        }}
                    >
                        <thead>
                            <tr>
                                {block.header.map((cell, at) => (
                                    <th key={at}>{spans(cell)}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {block.rows.map((row, at) => (
                                <tr key={at}>
                                    {row.map((cell, column) => (
                                        <td key={column}>{spans(cell)}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </Box>
                </Box>
            );

        case 'heading':
            return (
                <Box
                    key={index}
                    sx={{ fontSize: HEADING_SIZE[block.level - 1], fontWeight: 700, lineHeight: 1.3 }}
                >
                    {spans(block.text)}
                </Box>
            );

        case 'list':
            return (
                <Box
                    key={index}
                    component={block.ordered ? 'ol' : 'ul'}
                    sx={{ m: 0, pl: 2.5, display: 'flex', flexDirection: 'column', gap: 0.25 }}
                >
                    {block.items.map((item, at) => (
                        <li key={at}>{spans(item)}</li>
                    ))}
                </Box>
            );

        case 'code':
            return (
                <Box
                    key={index}
                    component="pre"
                    sx={{
                        m: 0,
                        p: 1,
                        borderRadius: 1,
                        bgcolor: CODE_BACKGROUND,
                        // code is the one thing that must not be broken across lines to fit a narrow panel
                        overflowX: 'auto',
                        fontFamily: 'monospace',
                        fontSize: 12.5,
                        lineHeight: 1.4,
                    }}
                >
                    {block.text}
                </Box>
            );

        case 'quote':
            return (
                <Box
                    key={index}
                    sx={{
                        pl: 1,
                        borderLeft: 3,
                        borderColor: 'divider',
                        opacity: 0.85,
                        whiteSpace: 'pre-wrap',
                    }}
                >
                    {spans(block.text)}
                </Box>
            );

        default:
            return (
                <Box
                    key={index}
                    sx={{ whiteSpace: 'pre-wrap' }}
                >
                    {spans(block.text)}
                </Box>
            );
    }
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
export default function MarkdownText(props: MarkdownTextProps): React.JSX.Element {
    // every token of a streamed answer parses it again, which for a page of text is nothing worth caching
    const blocks = markdownBlocks(props.text);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, wordBreak: 'break-word' }}>
            {blocks.map((block, index) => renderBlock(block, index, props.onLink))}
        </Box>
    );
}
