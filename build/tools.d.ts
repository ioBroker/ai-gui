import { type Connection } from '@iobroker/gui-components';
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
export declare function createToolSet(...tools: (AiTool | AiTool[])[]): AiToolSet;
/** The text of a name, which may be one per language */
export declare function textOf(name: ioBroker.StringOrTranslated | undefined | null): string;
/**
 * The reading tools every editor needs: find states, read a state, read an object
 *
 * @param socket the connection of the logged-in user
 */
export declare function ioBrokerReadTools(socket: Connection): AiTool[];
