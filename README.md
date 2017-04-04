# metarpheus-io-ts

Generate a [io-ts](https://github.com/gcanti/io-ts) domain model interpreting [metarpheus](https://github.com/buildo/metarpheus) output.

## Install

```sh
npm i metarpheus-io-ts
```

## Usage

```sh
metarpheus-io-ts -i path/to/input.json
metarpheus-io-ts -i path/to/input.json -o path/to/output.ts
```

## Usage from node

```js
import { printModels } from 'metarpheus-io-ts'

const source = ...
const models: string = printModels({ source })
```
