import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

// Execute actual TS modules with explicit dependency replacements, without initializing Firebase/Stripe.
export function typescriptLoader(mocks = {}) {
  const cache = new Map()
  function load(path) {
    const filename = resolve(root, path)
    if (cache.has(filename)) return cache.get(filename).exports
    const module = { exports: {} }
    cache.set(filename, module)
    const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }, fileName: filename,
    }).outputText
    const localRequire = (id) => {
      if (Object.hasOwn(mocks, id)) return mocks[id]
      if (id.startsWith('@/') || id.startsWith('.')) {
        let target = id.startsWith('@/') ? resolve(root, id.slice(2)) : resolve(dirname(filename), id)
        if (!/\.tsx?$/.test(target)) target += '.ts'
        return load(target)
      }
      return require(id)
    }
    new Function('require', 'module', 'exports', compiled)(localRequire, module, module.exports)
    return module.exports
  }
  return load
}
