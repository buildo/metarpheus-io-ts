import * as t from 'io-ts'
import * as gen from 'gen-io-ts'
import { ValidationError } from 'io-ts'
import { Either } from 'fp-ts/lib/Either'
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

export function getType(tpe: Tpe, isReadonly: boolean): gen.TypeReference {
  switch (tpe.name) {
    case 'String' :
    case 'Date' :
    case 'DateTime' :
    case 'Instant' :
      return gen.stringType
    case 'Int' :
    case 'Float' :
    case 'BigDecimal' :
      return gen.numberType
    case 'Boolean' :
      return gen.booleanType
    case 'Option' :
      return getType(tpe.args![0], isReadonly)
    case 'List' :
      return isReadonly ?
        gen.readonlyArrayCombinator(getType(tpe.args![0], isReadonly)) :
        gen.arrayCombinator(getType(tpe.args![0], isReadonly))
    case 'Map' :
      return gen.dictionaryCombinator(gen.stringType, getType(tpe.args![1], isReadonly))
    default :
      return gen.identifier(tpe.name)
  }
}

export const GetModelsOptions = t.interface({
  models: t.array(Model),
  isReadonly: t.boolean
})

export type GetModelsOptions = t.TypeOf<typeof GetModelsOptions>

function getProperty(member: CaseClassMember, isReadonly: boolean): gen.Property {
  const isOptional = member.tpe.name === 'Option'
  const type = getType(member.tpe, isReadonly)
  const option = isOptional ? gen.unionCombinator([type, gen.nullType]) : type
  return gen.property(member.name, option, false, member.desc)
}

function getDeclarations(models: Array<Model>, isReadonly: boolean): Array<gen.TypeDeclaration> {
  return models.map(model => {
    if (model.hasOwnProperty('values')) {
      const enumClass = model as EnumClass
      return gen.typeDeclaration(
        model.name,
        gen.enumCombinator(enumClass.values.map((v: any) => v.name), model.name),
        true,
        false
      )
    }
    const caseClass = model as CaseClass
    return gen.typeDeclaration(
      model.name,
      gen.interfaceCombinator(caseClass.members.map(member => getProperty(member, isReadonly)), model.name),
      true,
      isReadonly
    )
  })
}

const getModelsPrelude = `// DO NOT EDIT MANUALLY - metarpheus-generated
import * as t from 'io-ts'

`

export function getModels(options: GetModelsOptions): Either<Array<ValidationError>, string> {
  return t.validate(options, GetModelsOptions).map(options => {
    const declarations = getDeclarations(options.models, options.isReadonly)
    const sortedDeclarations = gen.sort(declarations)
    return getModelsPrelude + sortedDeclarations.map(d => gen.printStatic(d) + '\n\n' + gen.printRuntime(d)).join('\n\n')
  })
}

export const GetRoutesOptions = t.interface({
  routes: t.array(Route),
  isReadonly: t.boolean
})

export type GetRoutesOptions = t.TypeOf<typeof GetRoutesOptions>

function isRouteSegmentString(routeSegment: RouteSegment): routeSegment is RouteSegmentString {
  return routeSegment.hasOwnProperty('str')
}

function isRouteSegmentParam(routeSegment: RouteSegment): routeSegment is RouteSegmentParam {
  return routeSegment.hasOwnProperty('routeParam')
}

function getRoutePath(route: Route): string {
  const path = route.route.map(routeSegment => {
    if (isRouteSegmentString(routeSegment)) {
      return routeSegment.str
    }
    if (isRouteSegmentParam(routeSegment)) {
      throw new Error('RouteSegmentParam not yet supported')
    }
  }).join('/')
  return '`${apiEndpoint}/' + path + '`'
}

function getRouteParams(route: Route): string {
  let s = '{\n'
  s += route.params.filter(param => !param.inBody).map(param => {
    return `      ${param.name}`
  }).join(',\n')
  s += '\n    }'
  return s
}

function getRouteData(route: Route): string {
  let s = '{\n'
  s += route.params.filter(param => param.inBody).map(param => {
    return `      ${param.name}`
  }).join(',\n')
  s += '\n    }'
  return s
}

function getRouteHeaders(route: Route): string {
  const headers = [
    { name: `'Content-Type'`, value: `'application/json'` }
  ]
  if (route.method === 'get') {
    headers.push({ name: `'Pragma'`, value: `'no-cache'` })
    headers.push({ name: `'Cache-Control'`, value: `'no-cache, no-store'` })
  }
  if (route.authenticated) {
    headers.push({ name: `'Authorization'`, value: '`Token token="${token}"`' })
  }
  let s = '{\n'
  s += headers.map(header => {
    return `      ${header.name}: ${header.value}`
  }).join(',\n')
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
  s += `\n  return axios(${getAxiosConfig(route, isReadonly)}).then(res => unsafeValidate(res.data, ${gen.printRuntime(returns)})) as any`
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

export function getRoutes(options: GetRoutesOptions): Either<Array<ValidationError>, string> {
  return t.validate(options, GetRoutesOptions).map(options => {
    return getRoutesPrelude + options.routes.map(route => getRoute(route, options.isReadonly)).join('\n\n')
  })
}
