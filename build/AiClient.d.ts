import type { Connection } from '@iobroker/gui-components';
import { AI_COMMANDS, type AiChatResponse, type AiProvidersResponse } from '@iobroker/ai-core/build/shared/protocol';
import type { AiProvider, OpenAIMessage, OpenAITool } from '@iobroker/ai-core/build/shared/types';
/**
 * The way to the model: through the adapter, never straight out of the browser.
 *
 * The key of a provider stays in the configuration on the server. The editor sends the name of a
 * provider and the adapter puts the key on the request - so a browser tab holds no credential, and a
 * screenshot of it cannot leak one.
 *
 * A socket callback of `@iobroker/ws` is given up on after thirty seconds, while a model that is handed
 * a page of context and a dozen tools regularly needs longer. So the client subscribes to an instance
 * message and the adapter pushes the finished answer there; the callback carries nothing but the
 * acknowledgement. An adapter that does not know this answers the old way, which is handled unchanged.
 */
export interface AiClientOptions {
    /** Command names, if the adapter does not use the ones of `ai-core` */
    commands?: Partial<typeof AI_COMMANDS>;
    /** localStorage key under which the chosen model is remembered */
    storageKey?: string;
    /** How long the adapter has to answer a short question before it counts as one that does not know it */
    answerTimeout?: number;
    /** How long a chat answer may take; the adapter has a ceiling of its own */
    askTimeout?: number;
}
/** What a chat request came back with: the answer, or why there is none */
export type AiAskResult = AiChatResponse;
export declare class AiClient {
    readonly socket: Connection;
    readonly instance: string;
    private readonly commands;
    private readonly storageKey;
    private readonly answerTimeout;
    private readonly askTimeout;
    private readonly modelCache;
    private pushChannel;
    private pushChannelPromise;
    private requestCounter;
    /**
     * @param socket the connection to the ioBroker server
     * @param instance the adapter instance that talks to the model, like `vis-2.0`
     * @param options command names, storage key and timeouts
     */
    constructor(socket: Connection, instance: string, options?: AiClientOptions);
    /**
     * Which providers are configured. `null` means that nobody answered: an adapter that does not know
     * the command never calls back - which happens to everyone who updates the editor and not the adapter
     */
    getProviders(): Promise<AiProvidersResponse['providers'] | null>;
    /**
     * The chat models of a provider, or why it offered none. The reason comes back rather than an empty
     * list: an expired key, a local model that is not running - the provider says all of that
     *
     * @param provider whose models are wanted
     */
    getModels(provider: AiProvider): Promise<{
        models: string[];
        error?: string;
    }>;
    /** Forget what the providers said, for when a key has changed */
    clearModelCache(): void;
    /**
     * Which model to start with: the one used last, else the first choice for the provider, else the first
     *
     * @param models what the provider offers
     * @param provider which provider that is
     */
    preferredModel(models: string[], provider: AiProvider): string;
    /**
     * Remember a model for the next time
     *
     * @param model the one that was chosen
     */
    rememberModel(model: string): void;
    /** Forget the push channel, so the next question subscribes again */
    resetPushChannel(): void;
    /**
     * Subscribe for pushed answers, once. `null` where the adapter does not take such a subscription - the
     * caller then asks the plain way and lives with the thirty seconds
     */
    private ensurePushChannel;
    /**
     * Ask the model once
     *
     * @param request which model, the conversation so far, and what it may call
     * @param request.provider the provider of the model
     * @param request.model the name of the model
     * @param request.messages everything that was said so far
     * @param request.tools what the model may call
     * @param request.timeout how long to wait, default `askTimeout`
     */
    ask(request: {
        provider: AiProvider;
        model: string;
        messages: OpenAIMessage[];
        tools?: OpenAITool[];
        timeout?: number;
    }): Promise<AiAskResult>;
}
