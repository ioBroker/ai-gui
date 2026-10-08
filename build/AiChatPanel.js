import React from 'react';
import { Alert, Box, CircularProgress, IconButton, MenuItem, TextField, Tooltip, Typography } from '@mui/material';
import { Close as CloseIcon, DeleteSweep as ClearIcon, Send as SendIcon, Stop as StopIcon } from '@mui/icons-material';
import { I18n } from '@iobroker/gui-components';
import MarkdownText from './MarkdownText';
/**
 * The assistant, as a column of an editor.
 *
 * A chat, and under every answer the list of what it actually did. That list is the point: an
 * assistant that changes something has to say what it changed, in the words of the thing it changed,
 * or nobody can tell an error from a misunderstanding.
 *
 * @param props the chat and the texts of the editor
 */
export default function AiChatPanel(props) {
    const { chat } = props;
    const [text, setText] = React.useState('');
    const endRef = React.useRef(null);
    React.useEffect(() => {
        endRef.current?.scrollIntoView?.({ behavior: 'smooth' });
    }, [chat.messages]);
    const submit = () => {
        if (!text.trim() || chat.busy) {
            return;
        }
        chat.send(text);
        setText('');
    };
    const renderMessage = (message) => {
        const mine = message.role === 'user';
        return (React.createElement(Box, { key: message.id, sx: {
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
            } },
            message.pending && !message.content ? (React.createElement(CircularProgress, { size: 16, color: "inherit" })) : mine || message.role === 'error' ? (message.content) : (React.createElement(MarkdownText, { text: message.content, onLink: props.onLink })),
            message.actions?.length ? (React.createElement(Box, { component: "ul", sx: { m: 0, mt: message.content ? 1 : 0, pl: 2.5, opacity: 0.75, fontSize: 12.5 } }, message.actions.map((action, index) => (React.createElement("li", { key: index }, action))))) : null,
            message.truncated ? (React.createElement(Box, { sx: { mt: 1, fontSize: 12.5, color: 'warning.main' } }, I18n.t('ai_truncated'))) : null,
            !message.pending && props.renderMessageExtra ? props.renderMessageExtra(message) : null));
    };
    return (React.createElement(Box, { sx: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 } },
        React.createElement(Box, { sx: { display: 'flex', alignItems: 'center', gap: 1, p: 1, flexShrink: 0 } },
            React.createElement(Typography, { sx: { fontWeight: 600, flex: 1, minWidth: 0 }, noWrap: true }, props.title || I18n.t('ai_title')),
            props.headerActions,
            React.createElement(Tooltip, { title: I18n.t('ai_clear') },
                React.createElement("span", null,
                    React.createElement(IconButton, { size: "small", disabled: !chat.messages.length || chat.busy, onClick: chat.clear },
                        React.createElement(ClearIcon, { fontSize: "small" })))),
            props.onClose ? (React.createElement(Tooltip, { title: I18n.t('ai_close') },
                React.createElement(IconButton, { size: "small", onClick: props.onClose },
                    React.createElement(CloseIcon, { fontSize: "small" })))) : null),
        chat.problem ? (React.createElement(Alert, { severity: chat.problem === 'unreachable' ? 'warning' : 'info', sx: { m: 1 } }, chat.problem === 'unreachable'
            ? props.unreachableText || I18n.t('ai_no_adapter')
            : props.unconfiguredText || I18n.t('ai_no_key'))) : (React.createElement(Box, { sx: { display: 'flex', gap: 1, px: 1, pb: 1, flexShrink: 0 } },
            chat.providers.length > 1 ? (React.createElement(TextField, { select: true, size: "small", variant: "standard", sx: { width: 110 }, label: I18n.t('ai_provider'), value: chat.provider, onChange: event => chat.setProvider(event.target.value) }, chat.providers.map(one => (React.createElement(MenuItem, { key: one, value: one }, one))))) : null,
            React.createElement(TextField, { select: true, size: "small", variant: "standard", sx: { flex: 1, minWidth: 0 }, label: I18n.t('ai_model'), value: chat.models.includes(chat.model) ? chat.model : '', onChange: event => chat.setModel(event.target.value) }, chat.models.map(one => (React.createElement(MenuItem, { key: one, value: one }, one)))))),
        chat.modelsError ? (React.createElement(Alert, { severity: "error", sx: { m: 1 } }, chat.modelsError)) : !chat.problem && chat.provider && !chat.models.length ? (React.createElement(Alert, { severity: "info", sx: { m: 1 } }, I18n.t('ai_no_models'))) : null,
        React.createElement(Box, { sx: {
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                px: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
            } },
            chat.messages.length ? (chat.messages.map(renderMessage)) : (React.createElement(Box, { sx: { p: 1, opacity: 0.7, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 1 } },
                props.intro ? React.createElement("div", null, props.intro) : null,
                props.examples?.map(example => (React.createElement(Box, { key: example, onClick: () => setText(example), sx: {
                        cursor: 'pointer',
                        borderRadius: 2,
                        border: theme => `1px solid ${theme.palette.divider}`,
                        px: 1.5,
                        py: 1,
                        '&:hover': { borderColor: 'primary.main' },
                    } }, example))))),
            React.createElement("div", { ref: endRef })),
        React.createElement(Box, { sx: { display: 'flex', alignItems: 'flex-end', gap: 1, p: 1, flexShrink: 0 } },
            React.createElement(TextField, { fullWidth: true, multiline: true, maxRows: 6, size: "small", disabled: !!chat.problem || !chat.model, placeholder: props.placeholder || I18n.t('ai_placeholder'), value: text, onChange: event => setText(event.target.value), onKeyDown: event => {
                    // Enter sends, Shift+Enter is a new line - as everywhere else
                    if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        submit();
                    }
                } }),
            chat.busy ? (React.createElement(Tooltip, { title: I18n.t('ai_stop') },
                React.createElement(IconButton, { color: "error", onClick: chat.stop },
                    React.createElement(StopIcon, null)))) : (React.createElement(Tooltip, { title: I18n.t('ai_send') },
                React.createElement("span", null,
                    React.createElement(IconButton, { color: "primary", disabled: !text.trim() || !!chat.problem || !chat.model, onClick: submit },
                        React.createElement(SendIcon, null))))))));
}
//# sourceMappingURL=AiChatPanel.js.map