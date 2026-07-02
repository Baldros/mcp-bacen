# Local HTTPS tunnel for MCP validation

This is the quick validation path before paying for a hosted provider. It runs
the MCP server on this machine, exposes it with a temporary HTTPS tunnel, and
uses that public URL in ChatGPT Developer Mode or another MCP client.

This is for development only. The `trycloudflare.com` URL changes when the
tunnel restarts and should not be treated as a production endpoint.

## Endpoint

- Local MCP URL: `http://127.0.0.1:8787/mcp`
- Public connector URL after tunneling: `https://<tunnel-host>/mcp`
- Local status/root check: `http://127.0.0.1:8787/`

## Prerequisites

- Node.js `>=22`
- Dependencies installed with `npm install`
- One HTTPS tunnel tool:
  - Cloudflare Tunnel: `cloudflared`
  - Or ngrok: `ngrok`

On Windows, Cloudflare Tunnel can be installed with:

```powershell
winget install --id Cloudflare.cloudflared --exact
```

If the command is not on `PATH`, the executable is commonly here:

```text
C:\Program Files (x86)\cloudflared\cloudflared.exe
```

## Option A: run in two terminals

Terminal 1, start the MCP server:

```powershell
cd E:\mcp-bacen
npm run dev
```

Confirm local HTTP is responding:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/
```

Expected shape:

```json
{
  "name": "mcp-bacen",
  "mcp": "/mcp"
}
```

Terminal 2, start the HTTPS tunnel:

```powershell
cloudflared tunnel --url http://127.0.0.1:8787
```

If `cloudflared` is not on `PATH`:

```powershell
& "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://127.0.0.1:8787
```

Copy the generated URL, for example:

```text
https://example.trycloudflare.com
```

The MCP connector URL is:

```text
https://example.trycloudflare.com/mcp
```

### ngrok alternative

If you use ngrok instead of Cloudflare Tunnel:

```powershell
ngrok http 8787
```

Then use the forwarding host it prints, for example
`https://<subdomain>.ngrok.app/mcp`.

## Option B: run in background on Windows

Start the MCP server:

```powershell
$repo = "E:\mcp-bacen"
$env:PORT = "8787"
Start-Process -FilePath "npm.cmd" `
  -ArgumentList "run","dev" `
  -WorkingDirectory $repo `
  -WindowStyle Hidden `
  -RedirectStandardOutput "$env:TEMP\mcp-bacen.out.log" `
  -RedirectStandardError "$env:TEMP\mcp-bacen.err.log" `
  -PassThru
```

Start the tunnel:

```powershell
$cloudflared = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
Start-Process -FilePath $cloudflared `
  -ArgumentList "tunnel","--url","http://127.0.0.1:8787" `
  -WindowStyle Hidden `
  -RedirectStandardOutput "$env:TEMP\mcp-bacen-cloudflared.out.log" `
  -RedirectStandardError "$env:TEMP\mcp-bacen-cloudflared.err.log" `
  -PassThru
```

Read the tunnel URL from the log:

```powershell
Get-Content -Tail 80 "$env:TEMP\mcp-bacen-cloudflared.err.log" |
  Select-String "trycloudflare.com"
```

Stop the background processes by using the process IDs returned by
`Start-Process`:

```powershell
Stop-Process -Id <mcp-process-id>
Stop-Process -Id <cloudflared-process-id>
```

## Validate the public URL

Root check:

```powershell
Invoke-RestMethod https://<tunnel-host>/
```

MCP handshake and tool listing. Use `curl.exe` with a JSON body file:
PowerShell `Invoke-WebRequest` can hang on the streaming `/mcp` POST, so
`curl.exe` is more reliable here.

```powershell
cd $env:TEMP
Set-Content init.json '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"probe","version":"1.0"}}}' -NoNewline -Encoding ascii
Set-Content tools.json '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' -NoNewline -Encoding ascii

curl.exe -s -S -X POST https://<tunnel-host>/mcp `
  -H "Content-Type: application/json" `
  -H "Accept: application/json, text/event-stream" `
  -d "@init.json"

curl.exe -s -S -X POST https://<tunnel-host>/mcp `
  -H "Content-Type: application/json" `
  -H "Accept: application/json, text/event-stream" `
  -d "@tools.json"
```

The `initialize` call returns `serverInfo.name = mcp-bacen`, and `tools/list`
returns the seven tools (`search`, `fetch`, `list_sgs_series`,
`get_sgs_series`, `list_ptax_currencies`, `get_ptax_dollar_quotes`,
`get_ptax_currency_quotes`).

MCP Inspector:

```powershell
npx @modelcontextprotocol/inspector@latest --server-url https://<tunnel-host>/mcp --transport http
```

## Use in ChatGPT Developer Mode

1. Enable Developer Mode in ChatGPT.
2. Create a connector/app from a remote MCP server.
3. Use this URL:

```text
https://<tunnel-host>/mcp
```

4. For local validation, use no auth unless the server has been changed to
   require auth.

Official OpenAI reference:

```text
https://developers.openai.com/apps-sdk/deploy/connect-chatgpt
```

## Later provider deployment

The tunnel proves that the server works over public HTTPS. For a stable public
URL, deploy the same server to Render, Railway, Fly.io, or a VPS/container host.

Provider requirements:

- Public HTTPS URL
- Long-running Node service
- `npm install`, `npm run build`, `npm start`
- `PORT` environment variable supplied by the provider
- Connector URL ending in `/mcp`
- `APP_DOMAIN` set to the final HTTPS origin when using the Apps SDK widget,
  for example `https://mcp-bacen.example.com`

For multiple MCPs later, prefer one provider account with separate services or
subdomains:

- `mcp-sidra` on its own service and `/mcp`
- `mcp-bacen` on its own service and `/mcp`
- `sinal-aberto` on its own service and `/mcp`

That keeps each MCP simple while still using one billing/provider account.
