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
import sortBy from 'buildo-lodash-ts/lib/sortBy'

export function getType(tpe: Tpe, isReadonly: boolean): gen.TypeReference {
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
      return getType(tpe.args![0], isReadonly)
    case 'List':
    case 'Set':
    case 'TreeSet':
      return isReadonly
        ? gen.readonlyArrayCombinator(getType(tpe.args![0], isReadonly))
        : gen.arrayCombinator(getType(tpe.args![0], isReadonly))
    case 'Map':
      return gen.dictionaryCombinator(gen.stringType, getType(tpe.args![1], isReadonly))
    default:
      return gen.identifier(tpe.name)
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
  const option = isOptional ? gen.unionCombinator([type, optionalType]) : type
  return gen.property(member.name, option, false, member.desc)
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

export function getModels(models: Array<Model>, options: GetModelsOptions): string {
  const newtypes: { [key: string]: true } = {}
  options.newtypes.forEach(k => {
    newtypes[k] = true
  })
  const declarations = getDeclarations(models, options.isReadonly, options.optionalType || gen.nullType, newtypes)
  const sortedDeclarations = gen.sort(sortBy(declarations, ({ name }) => name))
  let out = ''
  if (options.runtime) {
    out += getModelsPrelude
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
        throw new Error('RouteSegmentParam not yet supported')
      }
    })
    .join('/')
  return '`${apiEndpoint}/' + path + '`'
}

function getRouteParams(route: Route): string {
  let s = '{\n'
  s += route.params
    .filter(param => !param.inBody)
    .map(param => {
      return `      ${param.name}`
    })
    .join(',\n')
  s += '\n    }'
  return s
}

function getRouteData(route: Route): string {
  let s = '{\n'
  s += route.params
    .filter(param => param.inBody)
    .map(param => {
      return `      ${param.name}`
    })
    .join(',\n')
  s += '\n    }'
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
      return `      ${header.name}: ${header.value}`
    })
    .join(',\n')
  s += '\n    }'
  return s
}

function getAxiosConfig(route: Route, isReadonly: boolean): string {
  let s = '{'
  s += `\n    method: '${route.method}',`
  s += `\n    url: ${getRoutePath(route)},`
  s += `\n    params: ${getRouteParams(route)},`
  s += `\n    data: ${getRouteData(route)},`
  s += `\n    headers: ${getRouteHeaders(route)},`
  s += `\n    timeout: 60000`
  s += '\n  }'
  return s
}

function getRouteArguments(route: Route, isReadonly: boolean): string {
  const params = route.params.map(param => {
    let type = getType(param.tpe, isReadonly)
    if (!param.required) {
      type = gen.unionCombinator([type, gen.nullType])
    }
    return {
      name: param.name,
      type: gen.printStatic(type)
    }
  })
  if (route.authenticated) {
    params.unshift({ name: 'token', type: 'string' })
  }
  return params.map(param => `${param.name}: ${param.type}`).join(', ')
}

function getRoute(route: Route, isReadonly: boolean): string {
  const name = route.name.join('_')
  const returns = getType(route.returns, isReadonly)
  let s = route.desc ? `/** ${route.desc} */\n` : ''
  s += `export function ${name}(${getRouteArguments(route, isReadonly)}): Promise<${gen.printStatic(returns)}> {`
  s += `\n  return axios(${getAxiosConfig(route, isReadonly)}).then(res => unsafeValidate(res.data, ${gen.printRuntime(
    returns
  )})) as any`
  s += '\n}'
  return s
}

const getRoutesPrelude = `// DO NOT EDIT MANUALLY - metarpheus-generated
import axios from 'axios'
import { pathReporterFailure } from 'io-ts/lib/reporters/default'

function unsafeValidate<T>(value: any, type: t.Type<T>): T {
  if (process.env.NODE_ENV !== 'production') {
    return t.validate(value, type)
      .fold(
        errors => { throw new Error(pathReporterFailure(errors).join('\\n')) },
        x => x
      )
  }
  return value as T
}

`

export function getRoutes(routes: Array<Route>, options: GetRoutesOptions): string {
  return getRoutesPrelude + routes.map(route => getRoute(route, options.isReadonly)).join('\n\n')
}
