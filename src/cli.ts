import * as program from 'commander'
import * as fs from 'fs'
import * as path from 'path'
import { pathReporterFailure } from 'io-ts/lib/reporters/default'
import { getModels, getRoutes } from './index'
import { Model, Route } from './domain'

program
  .option('-i, --in <file>', 'Input file')
  .option('-r, --readonly', 'Readonly models')
  .option('-R, --runtime', 'Also runtime models')
  .option('-o, --out [file]', 'Output file', x => x, '')
  .parse(process.argv)

if (!program.in) {
  throw new Error('missing input file')
}

const encoding = 'utf-8'
const source = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), program.in), encoding).toString())

const models: Array<Model> = source.models

getModels({ models, isReadonly: !!program.readonly, runtime: !program.runtime, newtypes: [] }).fold(
  errors => { throw new Error(pathReporterFailure(errors).join('\n')) },
  models => {
    if (program.out) {
      fs.writeFileSync(path.resolve(process.cwd(), `${program.out}-models.ts`), models, { encoding })
    } else {
      console.log(models)
    }
  }
)

const routes: Array<Route> = source.routes

getRoutes({ routes, isReadonly: !!program.readonly }).fold(
  errors => { throw new Error(pathReporterFailure(errors).join('\n')) },
  routes => {
    if (program.out) {
      fs.writeFileSync(path.resolve(process.cwd(), `${program.out}-routes.ts`), routes, { encoding })
    } else {
      console.log(routes)
    }
  }
)
