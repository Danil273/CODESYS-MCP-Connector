// PostToolUse-хук Claude Code: после правки проекта через codesys-master делает git add -A, коммит и push.
// Репозиторий: переменная CODESYS_GIT_REPO, иначе папка, где запущен Claude (CLAUDE_PROJECT_DIR).
// Вход — JSON хука на stdin. Ошибки не блокируют работу: только сообщение пользователю.
const { execFileSync } = require('child_process');

const REPO = process.env.CODESYS_GIT_REPO || process.env.CLAUDE_PROJECT_DIR || process.cwd();

function git(args) {
	return execFileSync('git', args, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 45000 }).trim();
}

function say(msg) {
	process.stdout.write(JSON.stringify({ systemMessage: msg }));
}

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
	let tool = 'MCP', target = '';
	try {
		const data = JSON.parse(raw);
		tool = (data.tool_name || '').replace(/^mcp__.+?__/, '');
		const inp = data.tool_input || {};
		target = inp.pouPath || inp.objectPath || inp.name || inp.folderName || '';
		target = target.replace(/^Application\//, '');
	} catch (e) { /* без имени объекта коммит всё равно нужен */ }

	try {
		git(['add', '-A']);
		if (!git(['status', '--porcelain'])) return; // Нечего коммитить
		git(['commit', '-q', '-m', `Авто (MCP): ${tool}${target ? ' ' + target : ''}`]);
	} catch (e) {
		return say(`Автокоммит не удался: ${(e.stderr || e.message).toString().split('\n')[0]}`);
	}

	try {
		git(['push', '-q']);
	} catch (e) {
		say(`Коммит сделан, но push не прошёл: ${(e.stderr || e.message).toString().split('\n')[0]}`);
	}
});
