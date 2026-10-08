import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { I18n } from '@iobroker/gui-components';
import { runToolLoop } from '@iobroker/ai-core/build/shared/toolLoop';
import { isTruncatedAnswer, stripThinkingArtifacts } from '@iobroker/ai-core/build/shared/models';
let counter = 0;
const nextId = () => `m${Date.now()}_${++counter}`;
export function useAiChat(options) {
    const { client } = options;
    const [messages, setMessages] = useState([]);
    const [busy, setBusy] = useState(false);
    const [providers, setProviders] = useState([]);
    const [provider, setProviderState] = useState('');
    const [models, setModels] = useState([]);
    const [model, setModelState] = useState('');
    const [modelsError, setModelsError] = useState('');
    const [problem, setProblem] = useState('');
    /** The conversation as the model sees it, without the system prompt; the panel shows something shorter */
    const history = useRef([]);
    const cancelled = useRef(false);
    /** The latest options, without the loop having to be rebuilt when they change */
    const latest = useRef(options);
    useLayoutEffect(() => {
        latest.current = options;
    });
    // which providers are configured
    useEffect(() => {
        let dropped = false;
        void (async () => {
            const available = await client.getProviders();
            if (dropped) {
                return;
            }
            if (!available) {
                setProblem('unreachable');
                return;
            }
            if (!available.length) {
                setProblem('unconfigured');
                return;
            }
            setProblem('');
            const names = available.map(one => one.provider);
            setProviders(names);
            setProviderState(current => (current && names.includes(current) ? current : names[0]));
        })();
        return () => {
            dropped = true;
        };
    }, [client]);
    // the models of the chosen provider
    useEffect(() => {
        if (!provider) {
            return;
        }
        let dropped = false;
        void (async () => {
            const answer = await client.getModels(provider);
            if (dropped) {
                return;
            }
            setModels(answer.models);
            setModelState(client.preferredModel(answer.models, provider));
            setModelsError(answer.error ? (answer.error === 'timeout' ? I18n.t('ai_no_answer') : answer.error) : '');
        })();
        return () => {
            dropped = true;
        };
    }, [client, provider]);
    const setModel = useCallback((next) => {
        setModelState(next);
        client.rememberModel(next);
    }, [client]);
    const clear = useCallback(() => {
        history.current = [];
        setMessages([]);
    }, []);
    const stop = useCallback(() => {
        cancelled.current = true;
    }, []);
    const send = useCallback((text) => {
        if (!text.trim() || !model || !provider) {
            return;
        }
        cancelled.current = false;
        setBusy(true);
        const answerId = nextId();
        const actions = [];
        setMessages(current => [
            ...current,
            { id: nextId(), role: 'user', content: text },
            { id: answerId, role: 'assistant', content: '', pending: true, actions: [] },
        ]);
        const update = (patch) => setMessages(current => current.map(one => (one.id === answerId ? { ...one, ...patch } : one)));
        void (async () => {
            history.current.push({ role: 'user', content: text });
            let turn = {};
            let failure = '';
            let finalText = '';
            let truncated = false;
            try {
                turn = latest.current.beginTurn
                    ? await latest.current.beginTurn()
                    : { tools: latest.current.tools };
                const tools = turn.tools;
                const result = await runToolLoop({
                    // the whole conversation goes along every time: a model has no memory of its own
                    messages: [{ role: 'system', content: latest.current.systemPrompt() }, ...history.current],
                    tools: tools?.definitions,
                    maxRounds: latest.current.maxRounds ?? 12,
                    shouldStop: () => cancelled.current,
                    ask: async (conversation, offered) => {
                        const answer = await client.ask({
                            provider,
                            model,
                            messages: conversation,
                            tools: offered,
                        });
                        if ('error' in answer && answer.error) {
                            throw new Error(answer.error);
                        }
                        return answer;
                    },
                    runTool: async (call, args) => {
                        if (!tools) {
                            return `There is no tool "${call.function.name}"`;
                        }
                        const outcome = await tools.run(call.function.name, args);
                        if (outcome.action) {
                            actions.push(outcome.action);
                            // the user watches the work being done rather than waiting for the answer
                            update({ actions: [...actions] });
                        }
                        return outcome.content;
                    },
                });
                history.current.push(...result.newMessages);
                finalText = stripThinkingArtifacts(result.content);
                truncated = !!result.answer && isTruncatedAnswer(result.answer);
                if (result.stopped) {
                    failure = I18n.t('ai_stopped');
                }
                else if (result.exhausted) {
                    failure = I18n.t('ai_too_many_steps');
                }
            }
            catch (e) {
                failure = e instanceof Error ? e.message : String(e);
                // the failed question leaves the history, so asking again does not send it twice
                history.current.pop();
            }
            try {
                await turn.end?.({ failed: !!failure });
            }
            catch (e) {
                failure ||= e instanceof Error ? e.message : String(e);
            }
            update({
                role: failure ? 'error' : 'assistant',
                content: failure || finalText || I18n.t('ai_done'),
                actions: [...actions],
                pending: false,
                truncated,
            });
            setBusy(false);
        })();
    }, [client, provider, model]);
    return {
        messages,
        busy,
        problem,
        provider,
        providers,
        setProvider: setProviderState,
        model,
        models,
        modelsError,
        setModel,
        send,
        clear,
        stop,
    };
}
//# sourceMappingURL=useAiChat.js.map