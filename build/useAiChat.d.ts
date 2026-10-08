import type { AiProvider } from '@iobroker/ai-core/build/shared/types';
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
    end?: (result: {
        failed: boolean;
    }) => void | Promise<void>;
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
export declare function useAiChat(options: UseAiChatOptions): UseAiChat;
