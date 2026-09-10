import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const repository = 'https://github.com/Nornttyy/linjian-cottage.git';
const authentication = ['-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential'];
function run(command, args, cwd = root, capture = false) {
    const result = spawnSync(command, args, { cwd, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${command} failed (${result.status})${capture ? ': ' + result.stderr : ''}`);
    return result.stdout?.trim();
}

run('git', ['diff', '--quiet', 'HEAD']);
const sourceCommit = run('git', ['rev-parse', '--verify', 'HEAD'], root, true);
run('npm', ['run', 'build:pages']);
const output = join(root, 'pages-dist');
if (!existsSync(join(output, 'index.html')) || !existsSync(join(output, '.nojekyll'))) {
    throw new Error('Missing GitHub Pages build output');
}
const stage = mkdtempSync(join(tmpdir(), 'linjian-pages-'));
try {
    cpSync(output, stage, { recursive: true });
    run('git', ['init', '-b', 'gh-pages'], stage);
    run('git', ['remote', 'add', 'origin', repository], stage);
    const probe = spawnSync('git', [...authentication, 'ls-remote', '--exit-code', 'origin', 'refs/heads/gh-pages'], { cwd: stage, encoding: 'utf8' });
    if (probe.status === 0) {
        run('git', [...authentication, 'fetch', '--depth=1', 'origin', 'gh-pages'], stage);
        run('git', ['update-ref', 'refs/heads/gh-pages', 'FETCH_HEAD'], stage);
    } else if (probe.status !== 2) {
        throw new Error(probe.stderr || 'Cannot read GitHub Pages branch');
    }
    run('git', ['add', '--all'], stage);
    run('git', ['-c', 'user.name=Codex', '-c', 'user.email=codex@openai.com', 'commit', '--allow-empty', '-m', `Publish game from ${sourceCommit}`], stage);
    run('git', [...authentication, 'push', 'origin', 'gh-pages'], stage);
    console.log('Published GitHub Pages branch:', run('git', ['rev-parse', '--verify', 'HEAD'], stage, true));
} finally {
    rmSync(stage, { recursive: true, force: true });
}
