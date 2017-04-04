import * as program from 'commander'
import * as fs from 'fs'
import * as path from 'path'
import { pathReporterFailure } from 'io-ts/lib/reporters/default'
import { getModels, Model } from './index'

program
  .option('-i, --in <file>', 'Input file')
  .option('-o, --out [file]', 'Output file', x => x, '')
  .parse(process.argv)

if (!program.in) {
  throw new Error('missing input file')
}

const encoding = 'utf-8'
const source: Array<Model> = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), program.in), encoding).toString()).models
getModels({ source }).fold(
  errors => { throw new Error(pathReporterFailure(errors).join('\n')) },
  models => {
    if (program.out) {
      fs.writeFileSync(path.resolve(process.cwd(), program.out), models, { encoding })
    } else {
      console.log(models)
    }
  }
)
