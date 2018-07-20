import * as fs from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';
import { getModels, getRoutes } from '../src/index';
import { Model, Route } from '../src/domain';

const sourceFileNames = fs.readdirSync(__dirname)
  .filter(file => file.endsWith('.json') && !file.startsWith('tsconfig'));

const removeFileNames = fs.readdirSync(__dirname).filter(file => file.endsWith('.dir'));

removeFileNames.forEach(removeFileName => {
  execSync(`rm -rf ${resolve(__dirname, removeFileName)}`);
});

sourceFileNames.forEach(sourceFileName => {
  const source = require(resolve(__dirname, sourceFileName));
  const modelsSource: Array<Model> = source.models;
  const routesSource: Array<Route> = source.routes;
  const modelsOutput = getModels(modelsSource, { isReadonly: false, runtime: true });
  const routesOutput = getRoutes(routesSource, modelsSource, { isReadonly: false });
  const dir = resolve(__dirname, `${sourceFileName}.dir`);
  fs.mkdirSync(dir);
  fs.writeFileSync(resolve(dir, 'model-ts.ts'), modelsOutput);
  fs.writeFileSync(resolve(dir, 'api-ts.ts'), routesOutput);
});
