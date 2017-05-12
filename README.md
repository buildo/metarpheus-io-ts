# metarpheus-io-ts

Generate static and runtime ([io-ts](https://github.com/gcanti/io-ts)) domain models interpreting [metarpheus](https://github.com/buildo/metarpheus) output.

## Install

```sh
npm i metarpheus-io-ts
```

## Usage

```sh
metarpheus-io-ts -i path/to/input.json -c path/to/config.json -o path/to/output.ts
```

## Usage from node

```js
import { getModels, getRoutes } from 'metarpheus-io-ts'

const source = ...
const models: string = getModels(source.models, modelsOptions)
const routes: string = getRoutes(source.routes, routesOptions)
```
