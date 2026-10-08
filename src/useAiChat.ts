import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { I18n } from '@iobroker/gui-components';

import type { AiProvider, OpenAIMessage } from '@iobroker/ai-core/build/shared/types';
import { runToolLoop } from '@iobroker/ai-core/build/shared/toolLoop';
import { isTruncatedAnswer, stripThinkingArtifacts } from '@iobroker/ai-core/build/shared/models';

import type { AiClient } from './AiClient';
import type { AiToolSet } from './tools';

/**
 * The agent loop of an editor, as a React hook.
 *
 * Say everything to the model, get back either an answer or a list of calls, run the calls, hand the
 * results back, repeat. The loop itself is `runToolLoop` of ai-core; this adds the model choice, the
 * conversation as the panel shows it, and the stop button.
 *
 * The loop is bounded: a model that keeps calling tools without ever answering would otherwise run
 * until the tab is closed - and spend real money doing it.
 */

/** One turn of the conversation, as the panel shows it */
export interface AiChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'error';
    content: string;
    /** What the assistant did in this turn, a line each: `Page "Kitchen" created` */
    actions?: string[];
    /** It is still being written */
    pending?: boolean;
    /** The model ran out of output budget, the answer ends mid-sentence */
    truncated?: boolean;
}

/** What one turn works with. `end` runs after the turn, whatever happened - vis-2 stores its project there */
export interface AiTurn {
    tools?: AiToolSet;
    end?: (result: { failed: boolean }) => void | Promise<void>;
}

export interface UseAiChatOptions {
    client: AiClient;
    /** The system prompt, built anew for every turn so it can say what the user is looking at */
    systemPrompt: () => string;
    /** The tools, when they are the same for every turn */
    tools?: AiToolSet;
    /** Called at the start of every turn instead of `tools`, for tools that work on a copy per turn */
    beginTurn?: () => AiTurn | Promise<AiTurn>;
    /** How many rounds of tool calls a turn may take, 12 by default */
    maxRounds?: number;
}

export type AiChatProblem = '' | 'unconfigured' | 'unreachable';

export interface UseAiChat {
    messages: AiChatMessage[];
    /** The model is thinking or a tool is running */
    busy: boolean;
    /** Why there is nothing to talk to: no provider configured, or an adapter that does not answer */
    problem: AiChatProblem;
    provider: AiProvider | '';
    providers: AiProvider[];
    setProvider: (provider: AiProvider) => void;
    model: string;
    models: string[];
    /** What the provider said instead of a list of models */
    modelsError: string;
    setModel: (model: string) => void;
    send: (text: string) => void;
    /** Start a new conversation */
    clear: () => void;
    /** Stop after the call that is running */
    stop: () => void;
}

let counter = 0;
const nextId = (): string => `m${Date.now()}_${++counter}`;

export function useAiChat(options: UseAiChatOptions): UseAiChat {
    const { client } = options;

    const [messages, setMessages] = useState<AiChatMessage[]>([]);
    const [busy, setBusy] = useState(false);
    const [providers, setProviders] = useState<AiProvider[]>([]);
    const [provider, setProviderState] = useState<AiProvider | ''>('');
    const [models, setModels] = useState<string[]>([]);
    const [model, setModelState] = useState('');
    const [modelsError, setModelsError] = useState('');
    const [problem, setProblem] = useState<AiChatProblem>('');

    /** The conversation as the model sees it, without the system prompt; the panel shows something shorter */
    const history = useRef<OpenAIMessage[]>([]);
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

    const setModel = useCallback(
        (next: string): void => {
            setModelState(next);
            client.rememberModel(next);
        },
        [client],
    );

    const clear = useCallback((): void => {
        history.current = [];
        setMessages([]);
    }, []);

    const stop = useCallback((): void => {
        cancelled.current = true;
    }, []);

    const send = useCallback(
        (text: string): void => {
            if (!text.trim() || !model || !provider) {
                return;
            }
            cancelled.current = false;
            setBusy(true);

            const answerId = nextId();
            const actions: string[] = [];
            setMessages(current => [
                ...current,
                { id: nextId(), role: 'user', content: text },
                { id: answerId, role: 'assistant', content: '', pending: true, actions: [] },
            ]);
            const update = (patch: Partial<AiChatMessage>): void =>
                setMessages(current => current.map(one => (one.id === answerId ? { ...one, ...patch } : one)));

            void (async () => {
                history.current.push({ role: 'user', content: text });
                let turn: AiTurn = {};
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
                            return answer as Exclude<typeof answer, { error: string }>;
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
                    } else if (result.exhausted) {
                        failure = I18n.t('ai_too_many_steps');
                    }
                } catch (e) {
                    failure = e instanceof Error ? e.message : String(e);
                    // the failed question leaves the history, so asking again does not send it twice
                    history.current.pop();
                }

                try {
                    await turn.end?.({ failed: !!failure });
                } catch (e) {
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
        },
        [client, provider, model],
    );

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
