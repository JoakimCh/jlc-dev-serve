
import * as fs from 'node:fs'
import * as path from 'node:path'
import {fileURLToPath} from 'node:url'

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url))

try {
  const path = path.join(moduleDirectory, 'node_modules/is-valid-domain/index.js')
  let script = fs.readFileSync(path, 'utf-8')
  script = script.replace(`require('punycode')`, `require('punycode/')`)
  fs.writeFileSync(path, script, 'utf-8')
} catch {}
