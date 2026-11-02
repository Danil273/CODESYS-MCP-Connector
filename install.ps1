<#
  Установка CODESYS MCP Connector:
  проверяет Node.js, ставит зависимости сервера (npm ci), показывает найденные CODESYS
  и регистрирует сервер codesys-master в Claude Code на уровне пользователя.

  Запуск:
    powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 [-DryRun] [-NoRegister] [-Force] [-Name codesys-master]

    -DryRun      показать команду регистрации, но не выполнять её
    -NoRegister  не регистрировать в Claude Code (для другого MCP-клиента — AGENTS.md, шаг 4)
    -Force       заменить уже зарегистрированный сервер с тем же именем (например, после переноса папки)
    -Name        имя MCP-сервера, по умолчанию codesys-master
#>
param(
	[switch]$DryRun,
	[switch]$NoRegister,
	[switch]$Force,
	[string]$Name = 'codesys-master'
)
$ErrorActionPreference = 'Stop'
$Server = Join-Path $PSScriptRoot 'server'
$Bin = Join-Path $Server 'dist\bin.js'
$ServerArgs = @($Bin, '--mode', 'persistent', '--no-auto-launch')

function Step($text) { Write-Host ''; Write-Host "== $text" -ForegroundColor Cyan }

# claude.exe: в PATH, у отдельной установки Claude Code — в ~\.local\bin,
# у приложения Claude — в Claude-Data (снаружи песочницы MSIX — в Packages\Claude_*\LocalCache)
function Find-ClaudeCli {
	$cmd = Get-Command claude -ErrorAction SilentlyContinue
	if ($cmd) { return $cmd.Source }
	$roots = @("$env:USERPROFILE\.local\bin", "$env:LOCALAPPDATA\Claude-Data")
	$roots += Get-ChildItem "$env:LOCALAPPDATA\Packages" -Directory -Filter 'Claude_*' -ErrorAction SilentlyContinue |
		ForEach-Object { Join-Path $_.FullName 'LocalCache\Local\Claude-Data' }
	$found = foreach ($r in $roots) {
		if (Test-Path $r) { Get-ChildItem $r -Recurse -Depth 5 -Filter 'claude.exe' -ErrorAction SilentlyContinue }
	}
	$found | Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
}

function Show-ManualConfig {
	$entry = [ordered]@{ type = 'stdio'; command = 'node'; args = $ServerArgs; env = @{} }
	Write-Host "Добавьте в %USERPROFILE%\.claude.json, в объект `"mcpServers`" (сначала сделайте копию файла):"
	Write-Host ("`"$Name`": " + ($entry | ConvertTo-Json -Depth 3))
	Write-Host 'Codex CLI и другие клиенты — AGENTS.md, раздел 1, шаг 4.'
}

Step 'Node.js'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
	throw 'Node.js не найден. Установите LTS-версию с https://nodejs.org и запустите скрипт в новом окне PowerShell.'
}
$nodeVer = (& node --version).Trim()
if ([int]($nodeVer.TrimStart('v').Split('.')[0]) -lt 18) { throw "Нужен Node.js 18 или новее, установлен $nodeVer." }
Write-Host "Node.js $nodeVer"
if ($PSScriptRoot -match '[^\x00-\x7F]|OneDrive') {
	Write-Warning "Папка коннектора: $PSScriptRoot. Надёжнее путь без кириллицы и OneDrive, например C:\Tools\CODESYS-MCP-Connector."
}

Step 'Зависимости сервера (npm ci, нужен интернет)'
Push-Location $Server
try {
	& npm ci --omit=dev --ignore-scripts --no-audit --no-fund
	if ($LASTEXITCODE -ne 0) { throw "npm ci завершился с кодом $LASTEXITCODE." }
} finally {
	Pop-Location
}

Step 'Установленные CODESYS'
& node $Bin --detect
if ($LASTEXITCODE -ne 0) { throw "Сервер не запустился (код $LASTEXITCODE)." }

if ($NoRegister) {
	Step 'Регистрация пропущена (-NoRegister)'
	Show-ManualConfig
} else {
	Step "Регистрация в Claude Code: $Name, для всех проектов пользователя"
	$registered = $false
	$cfgFile = Join-Path $env:USERPROFILE '.claude.json'
	if (Test-Path $cfgFile) {
		$registered = (& node -p "Boolean(((require(process.argv[1]).mcpServers)||{})[process.argv[2]])" $cfgFile $Name) -eq 'true'
	}
	$cli = Find-ClaudeCli
	$addArgs = @('mcp', 'add', '--scope', 'user', $Name, '--', 'node') + $ServerArgs
	if ($registered -and -not $Force) {
		Write-Host "Сервер '$Name' уже зарегистрирован. Заменить (например, после переноса папки): install.ps1 -Force"
	} elseif (-not $cli) {
		Write-Warning 'Claude Code CLI (claude.exe) не найден.'
		Show-ManualConfig
	} elseif ($DryRun) {
		if ($registered) { Write-Host ('Команда: "' + $cli + '" mcp remove --scope user ' + $Name) }
		$shown = foreach ($a in @($cli) + $addArgs) { if ($a -match ' ') { '"' + $a + '"' } else { $a } }
		Write-Host ('Команда: ' + ($shown -join ' '))
	} else {
		if ($registered) {
			& $cli mcp remove --scope user $Name
			if ($LASTEXITCODE -ne 0) { throw "claude mcp remove завершился с кодом $LASTEXITCODE." }
		}
		& $cli @addArgs
		if ($LASTEXITCODE -ne 0) { throw "claude mcp add завершился с кодом $LASTEXITCODE." }
	}
}

Step 'Готово. Дальше:'
Write-Host '1. Перезапустите приложение Claude (или Claude Code) и откройте новый чат.'
Write-Host '2. Откройте свой проект в CODESYS сами (двойной щелчок по .project).'
Write-Host '3. Напишите в чате: «Подключись к CODESYS». В заголовке окна CODESYS появится [MCP].'
Write-Host '4. Правила для нейросети в вашем проекте — templates\PROJECT-RULES.md (добавьте в CLAUDE.md проекта).'
