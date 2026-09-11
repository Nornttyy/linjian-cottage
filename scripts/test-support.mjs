import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

// The installed location is game/scripts. An explicit source root also allows
// these tests to run from a separate QA directory without touching that checkout.
export function compileProject({name = 'regression', api = false, isolates = 0, overlay, overrides = {}} = {}) {
    const source = process.env.LINJIAN_SOURCE
        ? resolve(process.env.LINJIAN_SOURCE)
        : fileURLToPath(new URL('../', import.meta.url));
    if (!existsSync(join(source, 'lib/simulation.ts')) || !existsSync(join(source, 'package.json')))
        throw new Error('Cannot locate game sources; place these files in game/scripts or set LINJIAN_SOURCE.');
    const ts = createRequire(join(source, 'package.json'))('typescript');
    const temp = mkdtempSync(join(tmpdir(), `linjian-${name}-`));
    const hashes = {};
    const cleanup = () => { rmSync(temp, {recursive: true, force: true}); process.removeListener('exit', cleanup); };
    process.once('exit', cleanup);
    const outputPath = input => join(temp, relative(source, input).replace(/\.tsx?$/, '.mjs'));
    function specifier(value, input, replacements) {
        if (replacements[value]) return replacements[value];
        if (!value.startsWith('.') && !value.startsWith('@/')) return value;
        const base = value.startsWith('@/') ? resolve(source, value.slice(2)) : resolve(dirname(input), value);
        const target = [base, base + '.ts', base + '.tsx', join(base, 'index.ts'), join(base, 'index.tsx')]
            .find(candidate => existsSync(candidate) && /\.(?:tsx?|json)$/.test(candidate));
        if (!target) return value;
        let result = relative(dirname(outputPath(input)), outputPath(target)).split(sep).join('/');
        if (!result.startsWith('.')) result = './' + result;
        return result;
    }
    function compile(input, replacements = {}) {
        const key = relative(source, input).split(sep).join('/');
        const candidate = overlay && key.startsWith('lib/') ? join(overlay, key.slice(4)) : null;
        const text = readFileSync(overrides[key] ?? (candidate && existsSync(candidate) ? candidate : input), 'utf8');
        hashes[relative(source, input)] = createHash('sha256').update(text).digest('hex');
        const output = ts.transpileModule(text, {
            fileName: input,
            compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX},
            transformers: {after: [context => {
                const visit = node => {
                    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier))
                        return ts.factory.updateImportDeclaration(node, node.modifiers, node.importClause,
                            ts.factory.createStringLiteral(specifier(node.moduleSpecifier.text, input, replacements)), node.attributes);
                    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier))
                        return ts.factory.updateExportDeclaration(node, node.modifiers, node.isTypeOnly, node.exportClause,
                            ts.factory.createStringLiteral(specifier(node.moduleSpecifier.text, input, replacements)), node.attributes);
                    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(node.arguments[0]))
                        return ts.factory.updateCallExpression(node, node.expression, node.typeArguments,
                            [ts.factory.createStringLiteral(specifier(node.arguments[0].text, input, replacements)), ...node.arguments.slice(1)]);
                    return ts.visitEachChild(node, visit, context);
                };
                return node => ts.visitNode(node, visit);
            }]},
        }).outputText;
        const dest = outputPath(input);
        mkdirSync(dirname(dest), {recursive: true});
        writeFileSync(dest, output);
        return dest;
    }
    function compileTree(directory) {
        for (const entry of readdirSync(directory, {withFileTypes: true})) {
            const input = join(directory, entry.name);
            if (entry.isDirectory()) compileTree(input);
            else if (/\.tsx?$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) compile(input);
            else if (entry.name.endsWith('.json')) {
                const dest = outputPath(input); mkdirSync(dirname(dest), {recursive: true}); writeFileSync(dest, readFileSync(input));
            }
        }
    }
    try {
        compileTree(join(source, 'lib'));
        if (api) {
            // Route tests always use an in-memory database, never a real room store.
            writeFileSync(join(temp, 'lib/store.mjs'), 'export async function getStore() { return globalThis.__networkTestDb; }\n');
            const route = compile(join(source, 'app/api/game/route.ts'));
            const routeText = readFileSync(route, 'utf8');
            for (let index = 0; index < isolates; index++) {
                writeFileSync(join(temp, `lib/room-sync-${index}.mjs`), readFileSync(join(temp, 'lib/room-sync.mjs')));
                writeFileSync(join(dirname(route), `route-${index}.mjs`), routeText.replace(/(room-sync)\.mjs/g, `$1-${index}.mjs`));
            }
        }
        return {source, temp, hashes, cleanup, compileFile: (name, replacements) => pathToFileURL(compile(join(source, name), replacements)).href,
            module: name => pathToFileURL(join(temp, 'lib', name + '.mjs')).href,
            route: index => pathToFileURL(join(temp, 'app/api/game', index === undefined ? 'route.mjs' : `route-${index}.mjs`)).href};
    } catch (error) { cleanup(); throw error; }
}
