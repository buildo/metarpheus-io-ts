import * as assert from 'assert'
import * as fs from 'fs'
import { pathReporterFailure } from 'io-ts/lib/reporters/default'
import { getModels, Model } from '../src'

function trimRight(s: string): string {
  return s.split('\n').map(s => (s as any).trimRight()).join('\n') + '\n'
}

describe('printModels', () => {

  it('should return the models in the right (source1)', () => {
    const expected = fs.readFileSync(__dirname + '/expected1.txt', 'utf-8')
    const source: Array<Model> = require('./source1.json').models
    getModels({ source }).fold(
      errors => { throw new Error(pathReporterFailure(errors).join('\n')) },
      models => {
        assert.strictEqual(trimRight(models), expected)
      }
    )
  })

  it('should return the models in the right (source2)', () => {
    const expected = fs.readFileSync(__dirname + '/expected2.txt', 'utf-8')
    const source: Array<Model> = require('./source2.json').models
    getModels({ source }).fold(
      errors => { throw new Error(pathReporterFailure(errors).join('\n')) },
      models => {
        assert.strictEqual(trimRight(models), expected)
      }
    )
  })

  it('should return the errors in the left', () => {
    getModels({ source: [1 as any] }).fold(
      errors => {
        assert.deepEqual(pathReporterFailure(errors).join('\n'), 'Invalid value 1 supplied to : { source: Array<Model> }/source: Array<Model>/0: Model')
      },
      models => assert.ok(false)
    )
  })

})
