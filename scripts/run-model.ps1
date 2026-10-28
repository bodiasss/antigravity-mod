param(
    [Parameter(Mandatory=$false)]
    [string]$Model = "deepseek-chat",
    [Parameter(Mandatory=$true)]
    [string]$Prompt,
    [Parameter(Mandatory=$false)]
    [string]$System = "You are a helpful software engineering assistant."
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$routerPath = "C:/Users/11sto/antigravity-mod/core/cross-model-kernel/model-router.js"
$payload = @{
    modelId = $Model
    messages = @(
        @{ role = "system"; content = $System },
        @{ role = "user"; content = $Prompt }
    )
} | ConvertTo-Json -Depth 6 -Compress

$env:AG_LITELLM_PAYLOAD = $payload
node -e "const r = require('$routerPath'); const p = JSON.parse(process.env.AG_LITELLM_PAYLOAD); r.sendChatCompletion(p).then(res => { console.log(res.content || ''); }).catch(err => { console.error(err.message); process.exit(1); });"
