import * as program from 'commander'
import * as fs from 'fs'
import * as path from 'path'
import { getModels, GetModelsOptions, getRoutes } from './index'
import { Model, Route } from './domain'

program
  .option('-i, --in <file>', 'Input file')
  .option('-c, --config [file]', 'Configuration')
  .option('-o, --out [file]', 'Output file', x => x, '')
  .parse(process.argv)

if (!program.in) {
  throw new Error('missing input file')
}
if (!program.config) {
  throw new Error('missing config file')
}

const encoding = 'utf-8'
const source = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), program.in), encoding).toString())
const config = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), program.config), encoding).toString())

const models: Array<Model> = source.models
const modelsOptions: GetModelsOptions = config.models

const modelsOut = getModels(models, modelsOptions)

if (program.out) {
  fs.writeFileSync(path.resolve(process.cwd(), `${program.out}-models.ts`), modelsOut, { encoding })
} else {
  console.log(modelsOut)
}

const routes: Array<Route> = source.routes

const routesOut = getRoutes(routes, { isReadonly: !!program.readonly })

if (program.out) {
  fs.writeFileSync(path.resolve(process.cwd(), `${program.out}-routes.ts`), routesOut, { encoding })
} else {
  console.log(routesOut)
}
