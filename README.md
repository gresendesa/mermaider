# The `mermaider` MCP server: fast, reliable Mermaid diagram syntax checker

<!-- markdown-toc start - Don't edit this section. Run M-x markdown-toc-refresh-toc -->
**Table of Contents**

- [The `mermaider` MCP server: fast, reliable Mermaid diagram syntax checker](#the-mermaider-mcp-server-fast-reliable-mermaid-diagram-syntax-checker)
  - [Overview](#overview)
    - [Why using the browser at all?](#why-using-the-browser-at-all)
  - [The LLMs syntax problem](#the-llms-syntax-problem)
  - [What makes `mermaider` different?](#what-makes-mermaider-different)
  - [Installation](#installation)
    - [VSCode](#vscode)
    - [Cursor/Windsuf/...](#cursorwindsuf)
    - [Bun](#bun)
  - [Recommendations](#recommendations)
  - [Usage Examples](#usage-examples)
  - [References](#references)
    - [Other Mermaid related MCP servers](#other-mermaid-related-mcp-servers)
    - [License](#license)

<!-- markdown-toc end -->

## Overview

The `mermaider` is an MCP server that provides `validate_syntax` tool that checks all Mermaid diagram types for syntax errors.

For that, it uses [`puppeteer-core` package][2] and [`mermaid-js/mermaid` API][3] directly to **efficiently** use already installed Chrome-based or Firefox browser.

Efficiently means:

- The browser (with a new page) is opened and kept running headless (by default) for as long as this MCP server process is active – to achieve low-latency tool calls.
- Every `validate_syntax` tool call reuses the browser and the page.

### Why using the browser at all?

Unfortunately, [`mermaid-js/mermaid`][3] relies on full browser context (DOM) for its functionality, even for parsing the diagrams. Packages like [happy-dom][4] or [jsdom][5] do not quite cut it.

The `mermaider` uses relatively light-weight [`puppeteer-core` package][2] (as opposed to full `puppeteer`) to access already installed browser.

## The LLMs syntax problem

Modern LLMs typically are perfectly capable of generating Mermaid diagrams, however often lack ability to reliably check the generated syntax. This is where the `mermaider` MCP comes in.

## What makes `mermaider` different?

There are other [MCPs](#other-mermaid-related-mcp-servers) that can (sort of) validate Mermaid syntax, however, they typically work by launching [`mmdc` command-line utility][1] process every time respective tool is invoked (by the LLM).

That brings a few issues:

- **Speed**: spawning `mmdc` process, which (then itself launches the browser) for every tool call is slow and expensive.
- **Non-determinism**: `mmdc`'s purpose really is to generate images, not validate syntax. As such, occasionally it exits with 0 code and generates an image (like one below) for diagrams with broken syntax as opposed to exiting with non-zero code and spitting out an error message to `STDERR`. In this case, MCP server that uses `mmdc` would have no idea the error occurred so you end up with a bunch of these images instead of your diagrams.

  ![Error image example](assets/error.png)
- **Side Effects**: `mmdc` [may install Chrome browser](https://pptr.dev/guides/installation) unbeknownst to you as that is the default puppeteer's behaviour, quote:

  >When you install Puppeteer, it automatically downloads a recent version of Chrome for Testing (~170MB macOS, ~282MB Linux, ~280MB Windows) and a chrome-headless-shell binary (starting with Puppeteer v21.6.0) that is guaranteed to work with Puppeteer. The browser is downloaded to the $HOME/.cache/puppeteer folder by default (starting with Puppeteer v19.0.0). See configuration for configuration options and environmental variables to control the download behavior.

## Installation

In general, below is the command that your MCP client should use:

```bash
npx -y @vtomilin/mermaider <config>
```

Where `<config>` is either an inline `JSON` string, or a config file path, e.g.

```bash
npx -y @vtomilin/mermaider '{"executablePath": "/Applications/FirefoxDeveloperEdition.app/Contents/MacOS/firefox", "browser": "firefox"}'
```

Or:

```bash
npx -y @vtomilin/mermaider /home/user/etc/Firefox.json
```

Where `/home/user/etc/Firefox.json` is a JSON file containing the configuration, for example, for Firefox browser:

```json
{
  "executablePath": "/Applications/FirefoxDeveloperEdition.app/Contents/MacOS/firefox",
  "browser": "firefox"
}
```

Another config file example, using the Brave (Chrome-based) browser:

```json
{
  "executablePath": "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
}

```

Complete list of available Browser configuration options defined in Puppeteer's Browser [`Launchoptions`](https://pptr.dev/api/puppeteer.launchoptions).

### VSCode

Press `Cmd-Shift-P` (or `Ctrl-Shift-P`), then `MCP: Add Server...`. Select `Command (stdio) Run a local command that implements the MCP protocol`. Enter `npx -y @vtomilin/mermaider /home/user/etc/Firefox.json` (or whatever config method). Enter the server name (`mermaider`). And you should be all set.

### Cursor/Windsuf/...

```json
{
  "mcpServers": {
    "mermaider": {
      "command": "npx",
      "args": ["-y", "@vtomilin/mermaider", "/home/user/etc/Firefox.json"]
    }
  }
}
```

### Bun

Even though this project is built with Bun the `mermaider` package can not be run directly with `bunx` at the moment. You would have to install the package globally with `bun add -g @vtomilin/mermaider` first. Then you can just use `mermaider-bun` executable to run the server:

```json
{
  "mcpServers": {
    "mermaider": {
      "command": "mermaider-bun",
      "args": ["/home/user/etc/Firefox.json"]
    }
  }
}
```

## Recommendations

- Check [Puppeteer's Supported Browsers List](https://pptr.dev/supported-browsers) for supported browsers.
- Use a secondary browser for `mermaider` MCP. Do not use your primary browser.

## Usage Examples

Example sessions using Github Copilot in VSCode:

- Generating a diagram and checking its syntax with `mermaider`:
  ![Correct Syntax](assets/use-sample.png)

- Generating an intentionally broken diagram and checking its syntax with `mermaider`:
![Invalid Syntax](assets/sample-error.png)

## References

### Other Mermaid related MCP servers

- [mcp-mermaid-validator](https://github.com/rtuin/mcp-mermaid-validator): A Model Context Protocol server that validates and renders Mermaid diagrams.
- [mermaid-mcp-server](https://github.com/abekdwight/mermaid-mcp-server): A Model Context Protocol (MCP) server providing tools for validating and rendering Mermaid diagrams.

[1]: <https://github.com/mermaid-js/mermaid-cli> "Mermaid `@mermaid-js/cli` package"
[2]: <https://github.com/puppeteer/puppeteer> "Puppeteer package"
[3]: <https://github.com/mermaid-js/mermaid> "mermaid-js/mermaid API package"
[4]: <https://github.com/capricorn86/happy-dom> "happy-dom"
[5]: <https://github.com/jsdom/jsdom> "jsdom"

### License

[MIT](LICENSE)


# Test Script for `mermaider` MCP Server

This is a simple shell script that tests the `mermaider` MCP server by connecting to its SSE endpoint, initializing the MCP protocol, and sending both valid and invalid Mermaid diagrams for syntax validation.
Use a container on the same Docker network as the `mermaider` server to run this script.
```sh
#!/bin/sh

# Configurações
TARGET="http://mermaider:3000"
SSE_LOG="/tmp/sse.log"

# Limpa logs antigos
rm -f $SSE_LOG

echo ">>> [1/4] Iniciando conexão SSE..."
# Inicia o curl em background, sem buffer (-N), salvando no log
curl -N -s "$TARGET/sse" > $SSE_LOG &
CURL_PID=$!

# Dá um tempo para o servidor responder com o evento 'endpoint'
sleep 2

# Extrai a URL de postagem do log SSE.
# O servidor mandou: data: /messages?sessionId=...
# Nós precisamos pegar essa parte para saber onde enviar os POSTs.
ENDPOINT_PATH=$(grep "data: " $SSE_LOG | grep "/messages" | head -n 1 | sed 's/^data: //')

# Remove possíveis caracteres de quebra de linha invisíveis (\r)
ENDPOINT_PATH=$(echo "$ENDPOINT_PATH" | tr -d '\r')

if [ -z "$ENDPOINT_PATH" ]; then
    echo "ERRO: Não foi possível obter o endpoint de mensagens do SSE."
    echo "Conteúdo atual do log SSE:"
    cat $SSE_LOG
    kill $CURL_PID
    exit 1
fi

FULL_ENDPOINT="${TARGET}${ENDPOINT_PATH}"
echo ">>> Endpoint para mensagens identificado: $FULL_ENDPOINT"

# Função auxiliar para enviar JSON-RPC
send_msg() {
    curl -s -X POST "$FULL_ENDPOINT" \
         -H "Content-Type: application/json" \
         -d "$1" >/dev/null
}

echo "\n>>> [2/4] Inicializando protocolo MCP..."
# 1. Initialize
send_msg '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"container-test","version":"1.0"}}}'
sleep 1
# 2. Initialized Notification
send_msg '{"jsonrpc":"2.0","method":"notifications/initialized"}'
sleep 1

echo "\n>>> [3/4] Executando testes de validação..."
echo " Enviando diagrama VÁLIDO..."
send_msg '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"validate_syntax","arguments":{"diagram_code":"graph TD;\nA-->B;"}}}'
sleep 2

echo " Enviando diagrama INVÁLIDO..."
send_msg '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"validate_syntax","arguments":{"diagram_code":"graph TD;\nTHIS IS BROKEN"}}}'
sleep 2

echo "\n>>> [4/4] Resultados (Log SSE):"
echo "---------------------------------------------------"
cat $SSE_LOG
echo "---------------------------------------------------"

# Verifica se tivemos sucesso
if grep -q "THIS IS BROKEN" $SSE_LOG && grep -q "Syntax error" $SSE_LOG; then
    echo "SUCESSO: O servidor detectou o erro de sintaxe corretamente!"
else
    echo "FALHA: Não foi possível confirmar a validação nos logs."
fi

# Limpeza
kill $CURL_PID
```
