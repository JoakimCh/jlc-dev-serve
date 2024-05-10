#!/usr/bin/env node

import * as fs from 'node:fs'

console.log('fixing dependency')
try {
  const path = 'node_modules/is-valid-domain/index.js'
  let script = fs.readFileSync(path, 'utf-8')
  script = script.replace(`require('punycode')`, `require('punycode/')`)
  fs.writeFileSync(path, script, 'utf-8')
} catch {}
