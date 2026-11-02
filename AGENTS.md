# CODESYS MCP Connector — инструкция для ИИ-агента

Этот файл для нейросети (Claude Code, Codex CLI и другие MCP-клиенты), которой пользователь поручил установить коннектор или работать через него с CODESYS. Описание для человека — `README.md`.

Коннектор — MCP-сервер `codesys-master` (Node.js, stdio). Он подключается к CODESYS, который пользователь открыл сам, и выполняет в нём команды: создание и правка POU, сборка, чтение ошибок, работа с ПЛК. Изменения сразу видны в окне CODESYS.

`<PKG>` ниже — папка, где лежит этот файл. Подставляй полный путь.

Проверено: Windows 11, CODESYS 3.5 SP21 Patch 1 (русский интерфейс), Node.js 24, приложение Claude (вкладка Code). Сервер также поддерживает CODESYS SP18, SP19 и SP22.

## 1. Установка (один раз)

Выполняй шаги по порядку и проверяй результат каждого. При ошибке не иди дальше: скажи пользователю, что не так и что нужно от него.

1. **Node.js.** `node --version` — нужен v18 или новее. Если Node.js нет, попроси пользователя поставить LTS с https://nodejs.org и перезапустить приложение. Сам не ставь.
2. **Папка.** Надёжнее путь без кириллицы, пробелов и OneDrive, например `C:\Tools\CODESYS-MCP-Connector`. Если пакет лежит в другом месте, предложи пользователю скопировать туда всю папку. Переносить после регистрации нельзя: путь записан в настройках MCP (после переноса — `install.ps1 -Force`).
3. **Установка и регистрация.** Запусти:
   ```
   powershell -NoProfile -ExecutionPolicy Bypass -File "<PKG>\install.ps1"
   ```
   Скрипт ставит зависимости сервера (`npm ci`, нужен интернет), показывает найденные CODESYS (`--detect`) и регистрирует сервер в Claude Code на уровне пользователя. Ключи: `-DryRun` — показать команду регистрации без выполнения, `-NoRegister` — без регистрации (для другого MCP-клиента), `-Force` — заменить уже зарегистрированный `codesys-master`.

   То же вручную:
   ```
   npm ci --prefix "<PKG>\server" --omit=dev --ignore-scripts --no-audit --no-fund
   node "<PKG>\server\dist\bin.js" --detect
   ```
   `--detect` должен показать хотя бы одну установку CODESYS. Если список пуст, CODESYS стоит не в `Program Files`: спроси у пользователя путь к `CODESYS.exe` и добавь в аргументы сервера `--codesys-path "<путь>" --codesys-profile "<профиль>"` (профиль — имя файла `*.profile.xml` в папке `CODESYS\Profiles` этой установки, без `.profile.xml`, например `CODESYS V3.5 SP21 Patch 1`).
4. **Регистрация в MCP-клиенте** (если не сделал `install.ps1`). Оба флага обязательны: `--mode persistent` — работа в окне CODESYS с интерфейсом, `--no-auto-launch` — сервер сам CODESYS не запускает.
   - **Claude Code / приложение Claude:**
     ```
     claude mcp add --scope user codesys-master -- node "<PKG>\server\dist\bin.js" --mode persistent --no-auto-launch
     ```
     У приложения Claude `claude.exe` обычно не в PATH. Он лежит в `%LOCALAPPDATA%\Claude-Data\<пакет>\claude-code\<версия>\<хэш>\claude.exe` (снаружи песочницы — `%LOCALAPPDATA%\Packages\Claude_*\LocalCache\Local\Claude-Data\...`). Бери самую новую версию.
     Регистрируй именно на уровне пользователя (`--scope user`, файл `%USERPROFILE%\.claude.json`). Сервер из проектного `.mcp.json` в приложении Claude пропадал со второго сообщения чата.
     Если CLI не найден, добавь вручную в `%USERPROFILE%\.claude.json`, объект `mcpServers` (сначала сделай копию файла):
     ```json
     "codesys-master": {
       "type": "stdio",
       "command": "node",
       "args": ["<PKG>\\server\\dist\\bin.js", "--mode", "persistent", "--no-auto-launch"],
       "env": {}
     }
     ```
   - **Codex CLI** — `%USERPROFILE%\.codex\config.toml`:
     ```toml
     [mcp_servers.codesys-master]
     command = "node"
     args = ['<PKG>\server\dist\bin.js', "--mode", "persistent", "--no-auto-launch"]
     tool_timeout_sec = 240
     ```
   - **Другой MCP-клиент:** stdio-сервер, команда `node`, аргументы те же.
5. **Перезапуск.** Попроси пользователя перезапустить приложение Claude (или Codex) и открыть новый чат. Проверка: в новом чате есть инструменты `mcp__codesys-master__*` (в Claude Code их находит ToolSearch по запросу `codesys-master attach`). Сервер может подключаться несколько секунд после старта чата.
6. **Правила для проекта.** Предложи добавить содержимое `<PKG>\templates\PROJECT-RULES.md` в `CLAUDE.md` (или `AGENTS.md`) папки, где пользователь работает со своим проектом CODESYS. Тогда нейросеть в каждом новом чате будет знать порядок работы. Заполни в шаблоне путь к проекту и версию CODESYS.
7. **По желанию** — автоматический git-коммит после каждой правки проекта: `<PKG>\extras\git-autopush\README.md`.

## 2. Работа с CODESYS

Полные правила — `templates/PROJECT-RULES.md`. Главное:

1. CODESYS открывает только пользователь (двойной щелчок по `.project`). Не вызывай `launch_codesys` и `launch_codesys_with_project`: такой CODESYS — дочерний процесс чата и закроется вместе с ним, а другой чат его не подхватит.
2. Первый вызов — `attach_codesys` без параметров. Успех — ответ «Attached to CODESYS …», в конце заголовка окна появляется `[MCP]`. До успешного attach не вызывай других инструментов `codesys-master`: без подключённого окна любой из них сам запустит новый CODESYS.
3. С одним CODESYS работает один чат. Ответ «used by another live MCP session» не обходи — скажи пользователю.
4. Не трогай ПЛК (загрузка, запись и форсирование переменных, старт/стоп, сброс) без явной просьбы.
5. Конец работы — `shutdown_codesys`: только отключает, окно и проект остаются у пользователя.

## 3. Как это устроено

```
ИИ-клиент ──stdio──> node server\dist\bin.js ──файлы в %TEMP%──> watcher.py внутри CODESYS ──> проект в окне
```

- На каждый вызов инструмента сервер пишет IronPython-скрипт `commands\<id>.py` и `commands\<id>.command.json` в папку сессии `%TEMP%\codesys-mcp-sp21-plus\<сессия>\`.
- `watcher.py` внутри CODESYS по таймеру UI-потока забирает команду, выполняет её через `exec()` и пишет ответ в `results\<id>.result.json`. Между командами меню CODESYS доступны, пользователь работает как обычно.
- `attach_codesys`: сервер пишет `%TEMP%\Codesys-MCP-Master\attach-codesys-mcp.py` и через Windows UI Automation (`server\dist\scripts\attach_uia.ps1`) нажимает в нужном окне CODESYS (по PID, не по активному окну) Инструменты → Скриптинг → Выполнить файл скрипта и подставляет путь в диалог. Мышь и клавиатуру не трогает. Скрипт запускает watcher и создаёт папку сессии `attach-<pid>-<время>`.
- Файлы в папке сессии: `ready.signal` — watcher работает (внутри PID CODESYS); `owner.json` — PID сервера, который держит сессию; `terminate.signal` — сессия завершена. У одного CODESYS одна живая сессия.
- Один сервер обслуживает все установленные версии CODESYS: версию выбирает по тому, в какой сохранён `.project`.
- Подробнее: `server/ARCHITECTURE.md`; все 132 инструмента — `server/docs/tools.md`; флаги — `server/docs/cli-reference.md`.

## 4. Диагностика

| Симптом | Причина | Что делать |
|---|---|---|
| В чате нет инструментов `codesys-master` | Сервер не зарегистрирован, приложение не перезапущено или сервер описан в проектном `.mcp.json` | Проверить `claude mcp list` или `mcpServers` в `%USERPROFILE%\.claude.json`; регистрировать с `--scope user`; перезапустить приложение |
| Сервер не стартует | Не установлены зависимости или папку перенесли | `node "<PKG>\server\dist\bin.js" --version`; при ошибке — шаг 3 установки; после переноса — `install.ps1 -Force` |
| `attach_codesys`: «No CODESYS opened by hand is running» | CODESYS не открыт, или открыт и подключён в другом чате | Попросить открыть проект; если открыт — см. строку «used by another live MCP session» |
| `attach_codesys` вернул список окон | Открыто несколько CODESYS | Спросить пользователя, какое окно; повторить с `pid` |
| Автоматика упала на шаге `menu` или `open` | В CODESYS открыт модальный диалог, или меню не нашлось | Попросить закрыть диалоги и повторить. Иначе `attach_codesys` с `auto: false` и дать пользователю путь `%TEMP%\Codesys-MCP-Master\attach-codesys-mcp.py` (раскрой `%TEMP%` в полный путь) для Инструменты → Скриптинг → Выполнить файл скрипта |
| «used by another live MCP session» | Этот CODESYS подключён в другом чате, и тот чат жив | Не обходить. Назвать пользователю тот чат и предложить отключиться там (`shutdown_codesys`) или закрыть/архивировать его. В приложении Claude чат находится так: процесс `claude.exe` с `--resume=<id>` → первое сообщение в `%USERPROFILE%\.claude\projects\<папка>\<id>.jsonl` |
| Кириллица превращается в `Ð Ð°Ð±...` | Сервер без исправления `watcher.py` | В `<PKG>\server\dist\scripts\watcher.py` чтение команд должно идти через `codecs.open(..., "utf-8")`; после правки — заново `attach_codesys` |
| CODESYS пишет «Этот путь не существует» для attach-скрипта | Старая сборка писала скрипт в `%LOCALAPPDATA%`, который приложение Claude (MSIX) перенаправляет в свою песочницу | В этой сборке исправлено (`%TEMP%`). `Test-Path` изнутри приложения Claude для `%LOCALAPPDATA%` врёт — видит файл, которого CODESYS не видит |
| `compile_project` показывает ошибки, которые уже исправлены | Сообщения копятся с открытия проекта | Очистить сообщения (раздел 5) и собрать заново |
| Вызов висит до тайм-аута | В CODESYS открыто модальное окно | Попросить пользователя посмотреть на окно CODESYS и закрыть диалог |

## 5. Свой скрипт в подключённом CODESYS

Если нужного инструмента нет (в `codesys-master` нет `eval_python`), скрипт можно выполнить через тот же watcher. Делай это, только когда не идёт вызов инструмента.

1. Живая папка сессии — `%TEMP%\codesys-mcp-sp21-plus\attach-<pid>-<время>\`, в которой есть `ready.signal` и нет `terminate.signal`.
2. Положи `commands\<id>.py` (UTF-8), затем `commands\<id>.command.json`: `{"requestId": "<id>", "scriptPath": "<полный путь к .py>"}`.
3. Ответ появится в `results\<id>.result.json` (поля `success`, `output`).

Скрипт: в начале `import System` и `from scriptengine import *`; без строки `# -*- coding` (код идёт через `exec`); без `system.ui.*` (модальное окно заблокирует CODESYS); в конце `print('SCRIPT_SUCCESS')`.

Пример — очистить сообщения перед сборкой: `for c in system.get_message_categories(): system.clear_messages(c)` (без аргумента `clear_messages` падает с `TypeError`).

## 6. Отличия от оригинала

Основа — [Codesys-MCP-Master](https://github.com/phobicdotno/Codesys-MCP-Master) 0.19.0, коммит `2c48700`, лицензия MIT (`server/LICENSE`). Сборка в `server/dist` уже содержит три исправления; они же патчем в `patches/local-fixes.patch`:

1. `src/scripts/watcher.py` — команды читаются как UTF-8 (`codecs.open`), `\r\n` заменяется на `\n`. IronPython читал UTF-8 как Latin-1, и кириллица в путях и комментариях портилась.
2. `src/attach.ts` — attach-скрипт пишется в `%TEMP%\Codesys-MCP-Master\`, а не в `%LOCALAPPDATA%`. Приложение Claude (MSIX) перенаправляет записи своих процессов в `%LOCALAPPDATA%` в песочницу, и CODESYS файл не находил.
3. `src/launcher.ts` — CODESYS, от которого отключились через `shutdown_codesys`, сразу можно подключить из другого чата. Раньше он числился за старым чатом, пока тот оставался открытым.

Обновиться с оригинала: клонировать репозиторий, `git checkout 2c48700` (или новее), `git apply <PKG>\patches\local-fixes.patch`, затем `npm install` и `npm run build`. Если патч не ложится — перенести три правки вручную по описанию выше.

## 7. Пересборка из исходников

```
cd <PKG>\server
npm install
npm run build
```

`npm install` ставит и dev-зависимости, а скрипт `prepare` сразу собирает `dist`. Python-скрипты инструментов читаются из `dist\scripts` при каждом вызове; `watcher.py` — при следующем `attach_codesys`. Изменения в `src\*.ts` действуют после перезапуска чата.
