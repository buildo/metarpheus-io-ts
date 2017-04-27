import * as assert from 'assert'
import * as fs from 'fs'
import { pathReporterFailure } from 'io-ts/lib/reporters/default'
import { getModels, getRoutes } from '../src/index'
import { Model, Route } from '../src/domain'

function trimRight(s: string): string {
  return s.split('\n').map(s => (s as any).trimRight()).join('\n') + '\n'
}

describe('getModels', () => {

  it('should return the models in the right (source1)', () => {
    const expected = fs.readFileSync(__dirname + '/expected-model1.txt', 'utf-8')
    const models: Array<Model> = require('./source1.json').models
    getModels({ models, isReadonly: false }).fold(
      errors => { throw new Error(pathReporterFailure(errors).join('\n')) },
      models => {
        assert.strictEqual(trimRight(models), expected)
      }
    )
  })

  it('should return the models in the right (source2)', () => {
    const expected = fs.readFileSync(__dirname + '/expected-model2.txt', 'utf-8')
    const models: Array<Model> = require('./source2.json').models
    getModels({ models, isReadonly: true }).fold(
      errors => { throw new Error(pathReporterFailure(errors).join('\n')) },
      models => {
        assert.strictEqual(trimRight(models), expected)
      }
    )
  })

  it('should return the models in the right (source3)', () => {
    const expected = fs.readFileSync(__dirname + '/expected-model3.txt', 'utf-8')
    const models: Array<Model> = require('./source3.json').models
    getModels({ models, isReadonly: false }).fold(
      errors => { throw new Error(pathReporterFailure(errors).join('\n')) },
      models => {
        assert.strictEqual(trimRight(models), expected)
      }
    )
  })

  it('should return the errors in the left', () => {
    getModels({ models: [1 as any], isReadonly: false }).fold(
      errors => {
        assert.deepEqual(pathReporterFailure(errors).join('\n'), 'Invalid value 1 supplied to : { models: Array<Model>, isReadonly: boolean }/models: Array<Model>/0: Model')
      },
      models => assert.ok(false)
    )
  })

})

describe('getRoutes', () => {

  it('should return the errors in the left', () => {
    getRoutes({ routes: [1 as any] }).fold(
      errors => {
        assert.deepEqual(pathReporterFailure(errors).join('\n'), 'Invalid value 1 supplied to : { routes: Array<Route> }/routes: Array<Route>/0: Route')
      },
      models => assert.ok(false)
    )
  })

  it('should return the routes in the right (source3)', () => {
    const expected = fs.readFileSync(__dirname + '/expected-route3.txt', 'utf-8')
    const routes: Array<Route> = require('./source3.json').routes
    getRoutes({ routes }).fold(
      errors => { throw new Error(pathReporterFailure(errors).join('\n')) },
      routes => {
        assert.strictEqual(trimRight(routes), expected)
      }
    )
  })

})
