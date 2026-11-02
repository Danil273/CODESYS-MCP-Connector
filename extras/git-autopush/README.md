# Автокоммит в git после правок через MCP (необязательно)

Хук Claude Code: после каждого инструмента `codesys-master`, который меняет проект (`create_*`, `set_pou_code`, `edit_text_lines`, `delete_object`, `rename_*`, `move_object`, `save_project*`, `add_*`, `remove_*`), делает `git add -A`, коммит «Авто (MCP): <инструмент> <объект>» и `git push`. Ошибки не мешают работе — приходит только сообщение.

Нужно: папка с `.project` — git-репозиторий с настроенным remote, и push работает без вопросов (например, `gh auth login` и `gh auth setup-git`).

## Подключение

1. Скопировать `codesys-git-autopush.js` в `<папка, где запускаете Claude>\.claude\hooks\`.
2. Добавить в `<папка, где запускаете Claude>\.claude\settings.json` блок `hooks` из `settings.example.json` (если файл уже есть — дописать в него).
3. Если репозиторий — не сама эта папка, а вложенная, указать его в `env.CODESYS_GIT_REPO`. Если сама папка — блок `env` не нужен.
4. Открыть новый чат: хуки читаются при старте.

Совет: добавьте в `.gitignore` репозитория `*.~u` и `*.precompilecache` — это временные файлы CODESYS.
