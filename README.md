# @iobroker/ai-gui

The AI chat of an ioBroker editor, shared by `admin`, `javascript` and `vis-2`: the client that talks to the
adapter, the agent loop as a React hook, the generic ioBroker tools, a Markdown renderer and the chat panel.
The backend side - providers, keys, the sendTo protocol - is [`@iobroker/ai-core`](https://github.com/ioBroker/ai-core).

The browser never holds a key. It names a provider, the adapter adds the key from its configuration or from
the credential store. The tools run here, with the connection of the logged-in user, so they can do exactly
what that user may do.

## Use in an editor

```tsx
import { AiChatPanel, AiClient, createToolSet, ioBrokerReadTools, registerAiTranslations, useAiChat } from '@iobroker/ai-gui';

registerAiTranslations();

function Assistant(props: { socket: Connection; instance: string; onClose: () => void }) {
    const client = useMemo(() => new AiClient(props.socket, props.instance, { storageKey: 'myEditor.ai.model' }), [props.socket, props.instance]);
    const tools = useMemo(() => createToolSet(ioBrokerReadTools(props.socket), myOwnTools), [props.socket]);

    const chat = useAiChat({
        client,
        tools,
        systemPrompt: () => 'You help with ... The user looks at ...',
    });

    return (
        <AiChatPanel
            chat={chat}
            intro="Tell me what to do."
            examples={['Which lights are on?']}
            unconfiguredText="Enter an API key in the instance settings, tab AI."
            onClose={props.onClose}
        />
    );
}
```

Tools that work on a copy per turn (vis-2 builds a whole page in one undo step) use `beginTurn` instead of
`tools`:

```ts
useAiChat({
    client,
    systemPrompt,
    beginTurn: () => {
        const project = copyOfProject();
        let changed = false;
        return {
            tools: createToolSet(ioBrokerReadTools(socket), visTools(project, () => (changed = true))),
            end: async () => changed && (await store(project)),
        };
    },
});
```

## Parts

- `AiClient` - `getProviders()`, `getModels(provider)`, `ask(request)`; subscribes for pushed answers
  (`aiChatAnswer`), so a request may take longer than the 30 s of a socket callback
- `useAiChat(options)` - provider and model choice, the conversation, `send`, `stop`, `clear`
- `createToolSet(...tools)`, `ioBrokerReadTools(socket)` - `search_objects`, `get_state`, `get_object`
- `AiChatPanel` - the panel; texts, examples, extra header buttons and a slot under every answer are props
- `MarkdownText`, `markdownBlocks`, `inlineSpans` - Markdown without HTML: paragraphs, headings, lists,
  quotes, tables, code, bold, italic, links (only `http(s)`, `mailto`, `#` and `/`). Links into the
  application (`#tab-instances`) open in the same window
- `registerAiTranslations()` - the texts of the panel in 11 languages

## Changelog
<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->
### **WORK IN PROGRESS**
- (@GermanBluefox) Fixed: the package has `main` and `exports`, so Node and vitest find it, not only a bundler

### 0.0.2 (2026-10-08)
- (@GermanBluefox) Initial version: client, chat hook, generic tools, Markdown and panel taken from vis-2 and javascript

## License
MIT License

Copyright (c) 2026 ioBroker Community Developers

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
