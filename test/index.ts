import * as assert from 'assert'
import * as fs from 'fs'
import { getModels, getRoutes } from '../src/index'
import { Model, Route } from '../src/domain'

function trimRight(s: string): string {
  return s.split('\n').map(s => (s as any).trimRight()).join('\n') + '\n'
}

describe('getModels', () => {
  it('should return the models (source1)', () => {
    const expected = fs.readFileSync(__dirname + '/expected-model1.txt', 'utf-8')
    const models: Array<Model> = require('./source1.json').models
    const out = getModels(models, { isReadonly: false, runtime: true, newtypes: [] })
    assert.strictEqual(trimRight(out), expected)
  })

  it('should return the models in the right (source2)', () => {
    const expected = fs.readFileSync(__dirname + '/expected-model2.txt', 'utf-8')
    const models: Array<Model> = require('./source2.json').models
    const out = getModels(models, { isReadonly: true, runtime: true, newtypes: [] })
    assert.strictEqual(trimRight(out), expected)
  })

  it('should return the models in the right (source3)', () => {
    const expected = fs.readFileSync(__dirname + '/expected-model3.txt', 'utf-8')
    const models: Array<Model> = require('./source3.json').models
    const out = getModels(models, { isReadonly: false, runtime: true, newtypes: [] })
    assert.strictEqual(trimRight(out), expected)
  })
})

describe('getRoutes', () => {
  it('should return the routes in the right (source3)', () => {
    const expected = fs.readFileSync(__dirname + '/expected-route3.txt', 'utf-8')
    const routes: Array<Route> = require('./source3.json').routes
    const out = getRoutes(routes, { isReadonly: false })
    assert.strictEqual(trimRight(out), expected)
  })
})
