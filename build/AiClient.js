import { AI_COMMANDS, AI_PUSH_MESSAGE_TYPE, } from '@iobroker/ai-core/build/shared/protocol';
import { isChatModel } from '@iobroker/ai-core/build/shared/models';
/** A first choice per provider - matched as a beginning, so a newer version of the family is found too */
const PREFERRED_MODELS = {
    anthropic: ['claude-sonnet-4', 'claude-opus-4', 'claude-3-7-sonnet'],
    openai: ['gpt-5', 'gpt-4.1', 'gpt-4o'],
    gemini: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
    deepseek: ['deepseek-chat'],
    custom: [],
};
function errorText(e) {
    return e instanceof Error ? e.message : String(e);
}
function withTimeout(promise, ms) {
    let timer;
    return Promise.race([
        promise,
        new Promise(resolve => {
            timer = setTimeout(() => resolve(null), ms);
        }),
    ]).finally(() => clearTimeout(timer));
}
export class AiClient {
    socket;
    instance;
    commands;
    storageKey;
    answerTimeout;
    askTimeout;
    modelCache = new Map();
    pushChannel = null;
    pushChannelPromise = null;
    requestCounter = 0;
    /**
     * @param socket the connection to the ioBroker server
     * @param instance the adapter instance that talks to the model, like `vis-2.0`
     * @param options command names, storage key and timeouts
     */
    constructor(socket, instance, options = {}) {
        this.socket = socket;
        this.instance = instance;
        this.commands = { ...AI_COMMANDS, ...options.commands };
        this.storageKey = options.storageKey || 'ai.model';
        this.answerTimeout = options.answerTimeout || 8000;
        this.askTimeout = options.askTimeout || 600_000;
    }
    /**
     * Which providers are configured. `null` means that nobody answered: an adapter that does not know
     * the command never calls back - which happens to everyone who updates the editor and not the adapter
     */
    async getProviders() {
        try {
            const answer = await withTimeout(this.socket.sendTo(this.instance, this.commands.providers, {}), this.answerTimeout);
            return answer === null ? null : answer?.providers || [];
        }
        catch {
            return null;
        }
    }
    /**
     * The chat models of a provider, or why it offered none. The reason comes back rather than an empty
     * list: an expired key, a local model that is not running - the provider says all of that
     *
     * @param provider whose models are wanted
     */
    async getModels(provider) {
        const cached = this.modelCache.get(provider);
        if (cached) {
            return { models: cached };
        }
        try {
            const answer = await withTimeout(this.socket.sendTo(this.instance, this.commands.models, {
                provider,
            }), 
            // the model list is also the test of the key, and some providers take their time
            Math.max(this.answerTimeout, 30_000));
            if (answer === null) {
                return { models: [], error: 'timeout' };
            }
            if (answer?.error) {
                return { models: [], error: answer.error };
            }
            const models = (answer?.models || []).filter(isChatModel);
            if (models.length) {
                this.modelCache.set(provider, models);
            }
            return { models };
        }
        catch (e) {
            return { models: [], error: errorText(e) };
        }
    }
    /** Forget what the providers said, for when a key has changed */
    clearModelCache() {
        this.modelCache.clear();
    }
    /**
     * Which model to start with: the one used last, else the first choice for the provider, else the first
     *
     * @param models what the provider offers
     * @param provider which provider that is
     */
    preferredModel(models, provider) {
        let remembered = '';
        try {
            remembered = window.localStorage.getItem(this.storageKey) || '';
        }
        catch {
            // no storage in this browser mode
        }
        if (remembered && models.includes(remembered)) {
            return remembered;
        }
        for (const wanted of PREFERRED_MODELS[provider] || []) {
            const found = models.find(model => model.startsWith(wanted));
            if (found) {
                return found;
            }
        }
        return models[0] || '';
    }
    /**
     * Remember a model for the next time
     *
     * @param model the one that was chosen
     */
    rememberModel(model) {
        try {
            if (model) {
                window.localStorage.setItem(this.storageKey, model);
            }
        }
        catch {
            // no storage in this browser mode
        }
    }
    /** Forget the push channel, so the next question subscribes again */
    resetPushChannel() {
        this.pushChannel = null;
        this.pushChannelPromise = null;
    }
    /**
     * Subscribe for pushed answers, once. `null` where the adapter does not take such a subscription - the
     * caller then asks the plain way and lives with the thirty seconds
     */
    ensurePushChannel() {
        if (this.pushChannel) {
            return Promise.resolve(this.pushChannel);
        }
        this.pushChannelPromise ||= (async () => {
            const channel = {
                sessionToken: `ai-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`,
                pending: new Map(),
            };
            try {
                // an adapter that knows nothing of it never calls back, so a silence counts as a no
                const result = await withTimeout(this.socket.subscribeOnInstance(this.instance, AI_PUSH_MESSAGE_TYPE, { sessionToken: channel.sessionToken }, (data) => {
                    const answer = data;
                    const id = answer?.requestId;
                    const waiting = id ? channel.pending.get(id) : undefined;
                    if (id && waiting) {
                        channel.pending.delete(id);
                        waiting(answer);
                    }
                }), this.answerTimeout);
                if (!result?.accepted) {
                    return null;
                }
                // the cast goes away with the next @iobroker/socket-client: `subscribeOnInstance` takes the
                // shape of the fields the instance adds as a type parameter there
                channel.sessionToken = result.session || channel.sessionToken;
                // a reconnect gives the socket a new id: the adapter would push to a client that is gone
                const onConnectionChange = (connected) => {
                    if (!connected) {
                        this.socket.unregisterConnectionHandler(onConnectionChange);
                        this.resetPushChannel();
                    }
                };
                this.socket.registerConnectionHandler(onConnectionChange);
                this.pushChannel = channel;
                return channel;
            }
            catch {
                return null;
            }
            finally {
                this.pushChannelPromise = null;
            }
        })();
        return this.pushChannelPromise;
    }
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
    async ask(request) {
        const timeout = request.timeout || this.askTimeout;
        const channel = await this.ensurePushChannel();
        const requestId = channel ? `req-${++this.requestCounter}-${Date.now().toString(36)}` : '';
        let answer;
        try {
            answer = await this.socket.sendTo(this.instance, this.commands.chat, {
                provider: request.provider,
                model: request.model,
                messages: request.messages,
                ...(request.tools?.length ? { tools: request.tools } : {}),
                timeout,
                ...(channel ? { uiSession: channel.sessionToken, requestId } : {}),
            });
        }
        catch (e) {
            return { error: errorText(e) };
        }
        // an adapter that does not push has answered in full already
        if (!channel || !answer?.accepted) {
            if (!answer) {
                return { error: 'The adapter answered with nothing' };
            }
            if (typeof answer === 'string') {
                // that is how the socket answers a permission error
                return { error: answer };
            }
            return answer;
        }
        return new Promise(resolve => {
            const timer = setTimeout(() => {
                channel.pending.delete(requestId);
                // it took the question and never pushed - most likely the adapter was restarted in between
                this.resetPushChannel();
                resolve({ error: `No answer within ${Math.round(timeout / 1000)}s` });
            }, timeout);
            channel.pending.set(requestId, pushed => {
                clearTimeout(timer);
                resolve(pushed);
            });
        });
    }
}
//# sourceMappingURL=AiClient.js.map