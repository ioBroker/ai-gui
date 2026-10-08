import { I18n, type Connection } from '@iobroker/gui-components';

import type { OpenAITool } from '@iobroker/ai-core/build/shared/types';

/**
 * Tools the model can call in the browser.
 *
 * A tool runs with the connection of the logged-in user, so it can do exactly what that user may do and
 * nothing more - the server checks every call against the user's rights. That is why the editors run
 * their tools here and not in the adapter.
 *
 * The reading tools answer short: a model that is handed nine thousand objects spends its whole context
 * on them and gets worse, not better.
 */

/** What a tool call gives back: text for the model, and optionally a line for the user */
export interface AiToolResult {
    /** What the model is told; JSON in all but the simplest cases */
    content: string;
    /** What the panel shows under the answer, like `Page "Kitchen" created` */
    action?: string;
}

/** One tool: what the model is told about it, and what it does */
export interface AiTool {
    definition: OpenAITool;
    run: (args: Record<string, unknown>) => Promise<AiToolResult | string>;
}

/** Tools as the chat hook takes them */
export interface AiToolSet {
    definitions: OpenAITool[];
    run: (name: string, args: Record<string, unknown>) => Promise<AiToolResult>;
}

/**
 * Bundle tools into a set. A later tool of the same name replaces an earlier one, so an editor can
 * replace a generic tool with its own
 *
 * @param tools the tools, in the order the model is told about them
 */
export function createToolSet(...tools: (AiTool | AiTool[])[]): AiToolSet {
    const byName = new Map<string, AiTool>();
    for (const tool of tools.flat()) {
        byName.set(tool.definition.function.name, tool);
    }
    return {
        definitions: [...byName.values()].map(tool => tool.definition),
        run: async (name, args) => {
            const tool = byName.get(name);
            if (!tool) {
                return { content: `There is no tool "${name}"` };
            }
            const result = await tool.run(args);
            return typeof result === 'string' ? { content: result } : result;
        },
    };
}

/** The text of a name, which may be one per language */
export function textOf(name: ioBroker.StringOrTranslated | undefined | null): string {
    if (!name) {
        return '';
    }
    if (typeof name === 'object') {
        return name[I18n.getLanguage()] || name.en || Object.values(name)[0] || '';
    }
    return String(name);
}

function str(value: unknown): string {
    return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

/**
 * The reading tools every editor needs: find states, read a state, read an object
 *
 * @param socket the connection of the logged-in user
 */
export function ioBrokerReadTools(socket: Connection): AiTool[] {
    return [
        {
            definition: {
                type: 'function',
                function: {
                    name: 'search_objects',
                    description:
                        'Find states of the installation by part of their id, their name or their role. Use this to find the datapoint the user means.',
                    parameters: {
                        type: 'object',
                        properties: {
                            query: { type: 'string', description: 'Part of an id, of a name, or of a role' },
                            role: {
                                type: 'string',
                                description: 'Only states of exactly this role, like `switch` or `level.dimmer`',
                            },
                            limit: { type: 'number', description: 'At most this many, 30 by default, 100 at most' },
                        },
                        required: ['query'],
                    },
                },
            },
            run: async args => {
                const query = str(args.query).toLowerCase();
                const role = str(args.role).toLowerCase();
                const limit = Math.min(Number(args.limit) || 30, 100);
                const objects = await socket.getObjectViewSystem('state', '', '香');
                const found: Record<string, unknown>[] = [];
                for (const id of Object.keys(objects)) {
                    const common = (objects[id] as ioBroker.StateObject | undefined)?.common;
                    if (!common) {
                        continue;
                    }
                    const name = textOf(common.name);
                    const objectRole = (common.role || '').toLowerCase();
                    if (role && objectRole !== role) {
                        continue;
                    }
                    if (
                        query &&
                        !id.toLowerCase().includes(query) &&
                        !name.toLowerCase().includes(query) &&
                        !objectRole.includes(query)
                    ) {
                        continue;
                    }
                    found.push({
                        id,
                        name,
                        type: common.type,
                        role: common.role,
                        unit: common.unit,
                        min: common.min,
                        max: common.max,
                        write: common.write,
                        states: common.states,
                    });
                    if (found.length >= limit) {
                        break;
                    }
                }
                return JSON.stringify({ found: found.length, states: found });
            },
        },
        {
            definition: {
                type: 'function',
                function: {
                    name: 'get_state',
                    description: 'The current value of a state.',
                    parameters: {
                        type: 'object',
                        properties: { id: { type: 'string', description: 'The id of the state' } },
                        required: ['id'],
                    },
                },
            },
            run: async args => {
                const id = str(args.id);
                if (!id) {
                    return 'The argument `id` is missing';
                }
                const state = await socket.getState(id);
                return JSON.stringify(
                    state
                        ? { id, value: state.val, ack: state.ack, ts: new Date(state.ts).toISOString() }
                        : { id, value: null, error: 'The state has no value' },
                );
            },
        },
        {
            definition: {
                type: 'function',
                function: {
                    name: 'get_object',
                    description:
                        'An object of the installation (state, channel, device, adapter instance, enum ...) with its type, its common part and the names of its parents.',
                    parameters: {
                        type: 'object',
                        properties: { id: { type: 'string', description: 'The id of the object' } },
                        required: ['id'],
                    },
                },
            },
            run: async args => {
                const id = str(args.id);
                if (!id) {
                    return 'The argument `id` is missing';
                }
                const obj = await socket.getObject(id);
                if (!obj) {
                    return JSON.stringify({ id, error: 'There is no such object' });
                }
                // the device and the channel say what a state belongs to: `Kitchen light` rather than `on`
                const parents: { id: string; type: string; name: string }[] = [];
                const parts = id.split('.');
                for (let length = parts.length - 1; length > 2 && parents.length < 3; length--) {
                    const parentId = parts.slice(0, length).join('.');
                    try {
                        const parent = await socket.getObject(parentId);
                        if (parent) {
                            parents.push({ id: parentId, type: parent.type, name: textOf(parent.common?.name) });
                        }
                    } catch {
                        // a parent that cannot be read is left out
                    }
                }
                return JSON.stringify({
                    id,
                    type: obj.type,
                    common: { ...obj.common, name: textOf(obj.common?.name) },
                    parents,
                });
            },
        },
    ];
}
