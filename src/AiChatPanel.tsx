import React from 'react';

import { Alert, Box, CircularProgress, IconButton, MenuItem, TextField, Tooltip, Typography } from '@mui/material';
import { Close as CloseIcon, DeleteSweep as ClearIcon, Send as SendIcon, Stop as StopIcon } from '@mui/icons-material';

import { I18n } from '@iobroker/gui-components';

import type { AiProvider } from '@iobroker/ai-core/build/shared/types';

import MarkdownText from './MarkdownText';
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
export default function AiChatPanel(props: AiChatPanelProps): React.JSX.Element {
    const { chat } = props;
    const [text, setText] = React.useState('');
    const endRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        endRef.current?.scrollIntoView?.({ behavior: 'smooth' });
    }, [chat.messages]);

    const submit = (): void => {
        if (!text.trim() || chat.busy) {
            return;
        }
        chat.send(text);
        setText('');
    };

    const renderMessage = (message: AiChatMessage): React.JSX.Element => {
        const mine = message.role === 'user';
        return (
            <Box
                key={message.id}
                sx={{
                    alignSelf: mine ? 'flex-end' : 'flex-start',
                    maxWidth: '92%',
                    px: 1.5,
                    py: 1,
                    borderRadius: 2,
                    fontSize: 14,
                    lineHeight: 1.45,
                    // what the user typed is shown as they typed it; the answer is Markdown and is rendered
                    whiteSpace: mine ? 'pre-wrap' : undefined,
                    wordBreak: 'break-word',
                    bgcolor: mine ? 'primary.main' : message.role === 'error' ? 'error.dark' : 'action.hover',
                    color: mine
                        ? 'primary.contrastText'
                        : message.role === 'error'
                          ? 'error.contrastText'
                          : 'text.primary',
                }}
            >
                {message.pending && !message.content ? (
                    <CircularProgress
                        size={16}
                        color="inherit"
                    />
                ) : mine || message.role === 'error' ? (
                    message.content
                ) : (
                    <MarkdownText
                        text={message.content}
                        onLink={props.onLink}
                    />
                )}
                {message.actions?.length ? (
                    <Box
                        component="ul"
                        sx={{ m: 0, mt: message.content ? 1 : 0, pl: 2.5, opacity: 0.75, fontSize: 12.5 }}
                    >
                        {message.actions.map((action, index) => (
                            <li key={index}>{action}</li>
                        ))}
                    </Box>
                ) : null}
                {message.truncated ? (
                    <Box sx={{ mt: 1, fontSize: 12.5, color: 'warning.main' }}>{I18n.t('ai_truncated')}</Box>
                ) : null}
                {!message.pending && props.renderMessageExtra ? props.renderMessageExtra(message) : null}
            </Box>
        );
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, flexShrink: 0 }}>
                <Typography
                    sx={{ fontWeight: 600, flex: 1, minWidth: 0 }}
                    noWrap
                >
                    {props.title || I18n.t('ai_title')}
                </Typography>
                {props.headerActions}
                <Tooltip title={I18n.t('ai_clear')}>
                    <span>
                        <IconButton
                            size="small"
                            disabled={!chat.messages.length || chat.busy}
                            onClick={chat.clear}
                        >
                            <ClearIcon fontSize="small" />
                        </IconButton>
                    </span>
                </Tooltip>
                {props.onClose ? (
                    <Tooltip title={I18n.t('ai_close')}>
                        <IconButton
                            size="small"
                            onClick={props.onClose}
                        >
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                ) : null}
            </Box>

            {chat.problem ? (
                <Alert
                    severity={chat.problem === 'unreachable' ? 'warning' : 'info'}
                    sx={{ m: 1 }}
                >
                    {chat.problem === 'unreachable'
                        ? props.unreachableText || I18n.t('ai_no_adapter')
                        : props.unconfiguredText || I18n.t('ai_no_key')}
                </Alert>
            ) : (
                <Box sx={{ display: 'flex', gap: 1, px: 1, pb: 1, flexShrink: 0 }}>
                    {chat.providers.length > 1 ? (
                        <TextField
                            select
                            size="small"
                            variant="standard"
                            sx={{ width: 110 }}
                            label={I18n.t('ai_provider')}
                            value={chat.provider}
                            onChange={event => chat.setProvider(event.target.value as AiProvider)}
                        >
                            {chat.providers.map(one => (
                                <MenuItem
                                    key={one}
                                    value={one}
                                >
                                    {one}
                                </MenuItem>
                            ))}
                        </TextField>
                    ) : null}
                    <TextField
                        select
                        size="small"
                        variant="standard"
                        sx={{ flex: 1, minWidth: 0 }}
                        label={I18n.t('ai_model')}
                        value={chat.models.includes(chat.model) ? chat.model : ''}
                        onChange={event => chat.setModel(event.target.value)}
                    >
                        {chat.models.map(one => (
                            <MenuItem
                                key={one}
                                value={one}
                            >
                                {one}
                            </MenuItem>
                        ))}
                    </TextField>
                </Box>
            )}

            {chat.modelsError ? (
                <Alert
                    severity="error"
                    sx={{ m: 1 }}
                >
                    {chat.modelsError}
                </Alert>
            ) : !chat.problem && chat.provider && !chat.models.length ? (
                <Alert
                    severity="info"
                    sx={{ m: 1 }}
                >
                    {I18n.t('ai_no_models')}
                </Alert>
            ) : null}

            <Box
                sx={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    px: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                }}
            >
                {chat.messages.length ? (
                    chat.messages.map(renderMessage)
                ) : (
                    <Box sx={{ p: 1, opacity: 0.7, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {props.intro ? <div>{props.intro}</div> : null}
                        {props.examples?.map(example => (
                            <Box
                                key={example}
                                onClick={() => setText(example)}
                                sx={{
                                    cursor: 'pointer',
                                    borderRadius: 2,
                                    border: theme => `1px solid ${theme.palette.divider}`,
                                    px: 1.5,
                                    py: 1,
                                    '&:hover': { borderColor: 'primary.main' },
                                }}
                            >
                                {example}
                            </Box>
                        ))}
                    </Box>
                )}
                <div ref={endRef} />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, p: 1, flexShrink: 0 }}>
                <TextField
                    fullWidth
                    multiline
                    maxRows={6}
                    size="small"
                    disabled={!!chat.problem || !chat.model}
                    placeholder={props.placeholder || I18n.t('ai_placeholder')}
                    value={text}
                    onChange={event => setText(event.target.value)}
                    onKeyDown={event => {
                        // Enter sends, Shift+Enter is a new line - as everywhere else
                        if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault();
                            submit();
                        }
                    }}
                />
                {chat.busy ? (
                    <Tooltip title={I18n.t('ai_stop')}>
                        <IconButton
                            color="error"
                            onClick={chat.stop}
                        >
                            <StopIcon />
                        </IconButton>
                    </Tooltip>
                ) : (
                    <Tooltip title={I18n.t('ai_send')}>
                        <span>
                            <IconButton
                                color="primary"
                                disabled={!text.trim() || !!chat.problem || !chat.model}
                                onClick={submit}
                            >
                                <SendIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
                )}
            </Box>
        </Box>
    );
}
