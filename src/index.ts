import * as gen from 'io-ts-codegen'
import {
  Tpe,
  Model,
  CaseClassMember,
  EnumClass,
  CaseClass,
  Route,
  RouteSegment,
  RouteSegmentString,
  RouteSegmentParam
} from './domain'
import sortBy = require('lodash/sortBy')
import uniq = require('lodash/uniq')

export function getType(tpe: Tpe, isReadonly: boolean, prefix: string = ''): gen.TypeReference {
  // TODO(gio): this should switch on structure, rather than on `tpe.name`
  switch (tpe.name) {
    case 'String':
    // case 'Date':
    // case 'DateTime':
    case 'Instant':
      return gen.stringType
    case 'Int':
    case 'Float':
    case 'BigDecimal':
      return gen.numberType
    case 'Boolean':
      return gen.booleanType
    case 'Any':
      return gen.anyType
    case 'Option':
      return getType(tpe.args![0], isReadonly, prefix)
    case 'List':
    case 'Set':
    case 'TreeSet':
      return isReadonly
        ? gen.readonlyArrayCombinator(getType(tpe.args![0], isReadonly, prefix))
        : gen.arrayCombinator(getType(tpe.args![0], isReadonly, prefix))
    case 'Map':
      return gen.dictionaryCombinator(gen.stringType, getType(tpe.args![1], isReadonly, prefix))
    default:
      return gen.identifier(`${prefix}${tpe.name}`)
  }
}

export type GetModelsOptions = {
  isReadonly: boolean
  runtime: boolean
  newtypes: Array<string>
  optionalType?: gen.TypeReference
}

function getProperty(member: CaseClassMember, isReadonly: boolean, optionalType: gen.TypeReference): gen.Property {
  const isOptional = member.tpe.name === 'Option'
  const type = getType(member.tpe, isReadonly)
  return gen.property(member.name, type, isOptional, member.desc)
}

function getNewtype(model: CaseClass): gen.TypeDeclaration {
  return gen.typeDeclaration(model.name, getType(model.members[0].tpe, false), true)
}

function getDeclarations(
  models: Array<Model>,
  isReadonly: boolean,
  optionalType: gen.TypeReference,
  newtypes: { [key: string]: true }
): Array<gen.TypeDeclaration> {
  return models.map(model => {
    if (newtypes.hasOwnProperty(model.name)) {
      return getNewtype(model as CaseClass)
    }
    if (model.hasOwnProperty('values')) {
      const enumClass = model as EnumClass
      return gen.typeDeclaration(
        model.name,
        gen.keyofCombinator(enumClass.values.map((v: any) => v.name), model.name),
        true,
        false
      )
    }
    const caseClass = model as CaseClass
    return gen.typeDeclaration(
      model.name,
      gen.interfaceCombinator(
        caseClass.members.map(member => getProperty(member, isReadonly, optionalType)),
        model.name
      ),
      true,
      isReadonly
    )
  })
}

const getModelsPrelude = `// DO NOT EDIT MANUALLY - metarpheus-generated
import * as t from 'io-ts'

`

export function getModels(models: Array<Model>, options: GetModelsOptions, prelude: string = getModelsPrelude): string {
  const newtypes: { [key: string]: true } = {}
  options.newtypes.forEach(k => {
    newtypes[k] = true
  })
  const declarations = getDeclarations(models, options.isReadonly, options.optionalType || gen.undefinedType, newtypes)
  const sortedDeclarations = gen.sort(sortBy(declarations, ({ name }) => name))
  let out = ''
  if (options.runtime) {
    out += prelude
  }
  out += sortedDeclarations
    .map(d => {
      return options.runtime ? gen.printStatic(d) + '\n\n' + gen.printRuntime(d) : gen.printStatic(d)
    })
    .join('\n\n')
  return out
}

export type GetRoutesOptions = {
  isReadonly: boolean
}

function isRouteSegmentString(routeSegment: RouteSegment): routeSegment is RouteSegmentString {
  return routeSegment.hasOwnProperty('str')
}

function isRouteSegmentParam(routeSegment: RouteSegment): routeSegment is RouteSegmentParam {
  return routeSegment.hasOwnProperty('routeParam')
}

function getRoutePath(route: Route): string {
  const path = route.route
    .map(routeSegment => {
      if (isRouteSegmentString(routeSegment)) {
        return routeSegment.str
      }
      if (isRouteSegmentParam(routeSegment)) {
        return '${' + routeSegment.routeParam.name + '}'
      }
    })
    .join('/')
  return '`${config.apiEndpoint}/' + path + '`'
}

function getRouteParams(route: Route): string {
  let s = '{\n'
  s += route.params
    .filter(param => !param.inBody)
    .map(param => {
      return `          ${param.name}`
    })
    .join(',\n')
  s += '\n        }'
  return s
}

function getRouteData(route: Route): string {
  if (route.method === 'post' && route.body) {
    return 'data' // the name `data` is hardcoded for this param in `getRouteArguments`
  }

  let s = '{\n'
  s += route.params
    .filter(param => param.inBody)
    .map(param => {
      return `          ${param.name}`
    })
    .join(',\n')
  s += '\n        }'
  return s
}

function getRouteHeaders(route: Route): string {
  const headers = [{ name: `'Content-Type'`, value: `'application/json'` }]
  if (route.method === 'get') {
    headers.push({ name: `'Pragma'`, value: `'no-cache'` })
    headers.push({ name: `'Cache-Control'`, value: `'no-cache, no-store'` })
  }
  if (route.authenticated) {
    headers.push({ name: `'Authorization'`, value: '`Token token="${token}"`' })
  }
  let s = '{\n'
  s += headers
    .map(header => {
      return `          ${header.name}: ${header.value}`
    })
    .join(',\n')
  s += '\n        }'
  return s
}

function getAxiosConfig(route: Route, isReadonly: boolean): string {
  let s = '{'
  s += `\n        method: '${route.method}',`
  s += `\n        url: ${getRoutePath(route)},`
  s += `\n        params: ${getRouteParams(route)},`
  s += `\n        data: ${getRouteData(route)},`
  s += `\n        headers: ${getRouteHeaders(route)},`
  s += '\n        timeout: config.timeout'
  s += '\n      }'
  return s
}

function getRouteArguments(route: Route, isReadonly: boolean): string {
  const params = [
    ...route.params,
    ...route.route.filter(isRouteSegmentParam).map(({ routeParam }, index) => ({ ...routeParam, name: routeParam.name || `param${index + 1}` }))
  ].map(param => {
    let type = getType(param.tpe, isReadonly, 'm.')
    if (!param.required) {
      type = gen.unionCombinator([type, gen.undefinedType])
    }
    return {
      name: param.name,
      type: gen.printStatic(type)
    }
  })
  if (route.authenticated) {
    params.unshift({ name: 'token', type: 'string' })
  }
  if (route.method === 'post' && route.body) {
    const bodyType = getType(route.body.tpe, isReadonly, 'm.')
    // the name `data` for this param is hardcoded in `getRouteData`
    params.push({ name: 'data', type: gen.printStatic(bodyType) })
  }
  if (uniq(params.map(p => p.name)).length !== params.length) {
    throw new Error('Some params have the same name')
  }
  return `{ ${params.map(param => param.name).join(', ')} }: { ${params.map(param => `${param.name}: ${param.type}`).join(', ')} }`
}

function getRoute(_route: Route, isReadonly: boolean): string {
  const segments = _route.route.reduce((acc, s: RouteSegment) => {
    return isRouteSegmentParam(s) ?
      { counter: acc.counter + 1, segments: [...acc.segments, { ...s, routeParam: { ...s.routeParam, name: s.routeParam.name || `param${acc.counter}` } } ] } :
      { counter: acc.counter, segments: [...acc.segments, s] }
  }, { counter: 1, segments: [] }).segments

  const route = { ..._route, route: segments }
  const name = route.name.join('_')
  const returns = getType(route.returns, isReadonly, 'm.')
  let s = route.desc ? `    /** ${route.desc} */\n` : ''
  s += `    ${name}: function (${getRouteArguments(route, isReadonly)}): Promise<${gen.printStatic(returns)}> {`
  s += `\n      return axios(${getAxiosConfig(route, isReadonly)}).then(res => unsafeValidate(config.unwrapApiResponse(res.data), ${gen.printRuntime(
      returns
    )}), parseError) as any`
  s += '\n    }'
  return s
}

const getRoutesPrelude = `// DO NOT EDIT MANUALLY - metarpheus-generated
import axios from 'axios'
import * as t from 'io-ts'
import * as m from './model-ts'

interface RouteConfig {
  apiEndpoint: string,
  timeout: number,
  unwrapApiResponse: (resp: any) => any
}

import { failure } from 'io-ts/lib/PathReporter'
export function unsafeValidate<S, A>(value: any, type: t.Type<S, A>): A {
  return t.validate(value, type).fold(errors => {
    throw new Error(failure(errors).join('\\n'))
  }, t.identity)
}

const parseError = (err: any) => {
  try {
    const { errors = [] } = JSON.parse(err.response.data);
    return Promise.reject({ status: err.response.status, errors });
  } catch (e) {
    return Promise.reject({ status: err && err.response && err.response.status || 0, errors: [] });
  }
};
`

export function getRoutes(routes: Array<Route>, options: GetRoutesOptions, prelude: string = getRoutesPrelude): string {
  return prelude +
`
export default function getRoutes(config: RouteConfig) {
  return {
`
+ routes.map(route => getRoute(route, options.isReadonly)).join(',\n\n') +
`
  }
}`
}
