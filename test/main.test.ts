import { getModels, getRoutes } from '../src/index';
import { Model, Route } from '../src/domain';

function trimRight(s: string): string {
  return (
    s
      .split('\n')
      .map(s => (s as any).trimRight())
      .join('\n') + '\n'
  );
}

describe('getModels', () => {
  it('should return the models (source1)', () => {
    const models: Array<Model> = require('./source1.json').models;
    const out = getModels(models, { runtime: true, useLegacyNewtype: false });
    expect(trimRight(out)).toMatchSnapshot();
  });

  it('should return the models in the right (source2)', () => {
    const models: Array<Model> = require('./source2.json').models;
    const out = getModels(models, { runtime: true, useLegacyNewtype: false });
    expect(trimRight(out)).toMatchSnapshot();
  });

  it('should return the models in the right (source3)', () => {
    const models: Array<Model> = require('./source3.json').models;
    const out = getModels(models, { runtime: true, useLegacyNewtype: false });
    expect(trimRight(out)).toMatchSnapshot();
  });

  it('should return the models in the right (source4)', () => {
    const models: Array<Model> = require('./source4.json').models;
    const out = getModels(models, { runtime: true, useLegacyNewtype: false });
    expect(trimRight(out)).toMatchSnapshot();
  });

  it('should handle any', () => {
    const models: Array<Model> = require('./source-any.json').models;
    const out = getModels(models, { runtime: true, useLegacyNewtype: false });
    expect(trimRight(out)).toMatchSnapshot();
  });

  it('should allow legacy newtype encoding', () => {
    const models: Array<Model> = require('./source-legacy-newtype').models;
    const out = getModels(models, { runtime: true, useLegacyNewtype: true });
    expect(trimRight(out)).toMatchSnapshot();
  });

  it('should handle tagged union types', () => {
    const models: Array<Model> = require('./source-tagged-unions').models;
    const out = getModels(models, { runtime: true, useLegacyNewtype: true });
    expect(trimRight(out)).toMatchSnapshot();
  });
});

describe('getRoutes', () => {
  it('should return the routes in the right (source3)', () => {
    const routes: Array<Route> = require('./source3.json').routes;
    const models: Array<Model> = require('./source3.json').models;
    const out = getRoutes(routes, models);
    expect(trimRight(out)).toMatchSnapshot();
  });

  it('should return the routes in the right (source4)', () => {
    const routes: Array<Route> = require('./source4.json').routes;
    const models: Array<Model> = require('./source4.json').models;
    const out = getRoutes(routes, models);
    expect(trimRight(out)).toMatchSnapshot();
  });
});
