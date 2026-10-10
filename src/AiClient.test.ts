import { describe, expect, it } from 'vitest';

import { AiClient } from './AiClient';

/** Just enough of a Connection: `sendTo` answers from `answers`, `subscribeOnInstance` as configured */
function fakeSocket(options: { push?: boolean; session?: string; answers: Record<string, (data: any) => any> }): any {
    let pushHandler: ((data: unknown) => void) | null = null;
    const sent: { command: string; data: any }[] = [];
    return {
        sent,
        push: (data: unknown) => pushHandler?.(data),
        sendTo: async (_instance: string, command: string, data: any) => {
            sent.push({ command, data });
            return options.answers[command]?.(data);
        },
        subscribeOnInstance: async (_instance: string, _type: string, _data: any, callback: any) => {
            if (!options.push) {
                return { accepted: false };
            }
            pushHandler = callback;
            return options.session ? { accepted: true, session: options.session } : { accepted: true };
        },
        registerConnectionHandler: () => {},
        unregisterConnectionHandler: () => {},
    };
}

describe('AiClient', () => {
    it('asks the plain way when the adapter does not push', async () => {
        const socket = fakeSocket({ answers: { 'ai:chat': () => ({ success: true, content: 'hi' }) } });
        const client = new AiClient(socket, 'vis-2.0');
        const answer = await client.ask({ provider: 'openai', model: 'm', messages: [{ role: 'user', content: 'x' }] });
        expect(answer).toEqual({ success: true, content: 'hi' });
        expect(socket.sent[0].data.uiSession).toBeUndefined();
    });

    it('waits for the pushed answer when the adapter accepted the question', async () => {
        const socket = fakeSocket({
            push: true,
            answers: {
                'ai:chat': data => {
                    setTimeout(
                        () =>
                            socket.push({
                                type: 'aiChatAnswer',
                                requestId: data.requestId,
                                success: true,
                                content: 'later',
                            }),
                        5,
                    );
                    return { accepted: true, requestId: data.requestId };
                },
            },
        });
        const client = new AiClient(socket, 'admin.0');
        const answer = await client.ask({
            provider: 'anthropic',
            model: 'm',
            messages: [{ role: 'user', content: 'x' }],
        });
        expect(answer).toMatchObject({ success: true, content: 'later' });
        expect(socket.sent[0].data.uiSession).toMatch(/^ai-/);
    });

    it('names the session secret the adapter handed out, not one of its own', async () => {
        const socket = fakeSocket({
            push: true,
            session: 'from-the-adapter',
            answers: {
                'ai:chat': data => {
                    setTimeout(() => socket.push({ requestId: data.requestId, success: true, content: 'ok' }), 5);
                    return { accepted: true, requestId: data.requestId };
                },
            },
        });
        const client = new AiClient(socket, 'javascript.0');
        await client.ask({ provider: 'openai', model: 'm', messages: [{ role: 'user', content: 'x' }] });
        expect(socket.sent[0].data.uiSession).toBe('from-the-adapter');
    });

    it('uses the command names it is given', async () => {
        const socket = fakeSocket({
            answers: { getAvailableAiProviders: () => ({ providers: [{ provider: 'custom' }] }) },
        });
        const client = new AiClient(socket, 'javascript.0', { commands: { providers: 'getAvailableAiProviders' } });
        expect(await client.getProviders()).toEqual([{ provider: 'custom' }]);
    });

    it('says that nobody answered rather than that nothing is configured', async () => {
        const socket = fakeSocket({ answers: { 'ai:providers': () => new Promise(() => {}) } });
        const client = new AiClient(socket, 'vis-2.0', { answerTimeout: 20 });
        expect(await client.getProviders()).toBeNull();
    });

    it('keeps only chat models and remembers them per provider', async () => {
        let asked = 0;
        const socket = fakeSocket({
            answers: {
                'ai:models': () => {
                    asked++;
                    return { success: true, models: ['gpt-5', 'text-embedding-3-small', 'dall-e-3'] };
                },
            },
        });
        const client = new AiClient(socket, 'vis-2.0');
        expect((await client.getModels('openai')).models).toEqual(['gpt-5']);
        await client.getModels('openai');
        expect(asked).toBe(1);
    });

    it('passes the reason of a provider on', async () => {
        const socket = fakeSocket({ answers: { 'ai:models': () => ({ error: 'Invalid API key (401)' }) } });
        const client = new AiClient(socket, 'vis-2.0');
        expect(await client.getModels('openai')).toEqual({ models: [], error: 'Invalid API key (401)' });
    });

    it('prefers a known first choice of the provider', () => {
        const client = new AiClient(fakeSocket({ answers: {} }), 'vis-2.0', { storageKey: 'test.ai.model' });
        expect(client.preferredModel(['claude-3-haiku', 'claude-sonnet-4-5-20250929'], 'anthropic')).toBe(
            'claude-sonnet-4-5-20250929',
        );
        expect(client.preferredModel(['llama3'], 'custom')).toBe('llama3');
    });
});
