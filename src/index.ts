import * as gen from 'io-ts-codegen';
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
} from './domain';
import sortBy = require('lodash/sortBy');
import uniq = require('lodash/uniq');
import lowerFirst = require('lodash/lowerFirst');

// FIXME(gabro): super-hack because I'm lazy and I don't want to pass this parameter around
let _models: Array<Model>;

function isNewtype(tpe: Tpe): boolean {
  const model = _models.find(m => m.name === tpe.name);
  return !!(model && 'isValueClass' in model && model.isValueClass);
}

const genericCombinator = (tpe: Tpe, prefix: string): gen.CustomCombinator => {
  const type = gen.identifier(`${prefix}${tpe.name}`);
  const staticArgs = tpe.args!.map(arg => gen.printStatic(getType(arg, false, prefix))).join(', ');
  const runtimeArgs = tpe.args!.map(arg => gen.printRuntime(getType(arg, false, prefix))).join(', ');

  return gen.customCombinator(
    `${gen.printStatic(type)}<${staticArgs}>`,
    isNewtype(tpe) ? `${gen.printRuntime(type)}<${staticArgs}>()` : `${gen.printRuntime(type)}(${runtimeArgs})`,
    []
  );
};

export function getType(tpe: Tpe, isReadonly: boolean, prefix: string = ''): gen.TypeReference {
  // TODO(gio): this should switch on structure, rather than on `tpe.name`
  switch (tpe.name) {
    case 'String':
    // case 'Date':
    // case 'DateTime':
    case 'Instant':
      return gen.stringType;
    case 'Int':
    case 'Float':
    case 'BigDecimal':
      return gen.numberType;
    case 'Boolean':
      return gen.booleanType;
    case 'Any':
      return gen.anyType;
    case 'Option':
      return getType(tpe.args![0], isReadonly, prefix);
    case 'List':
    case 'Set':
    case 'TreeSet':
      return isReadonly
        ? gen.readonlyArrayCombinator(getType(tpe.args![0], isReadonly, prefix))
        : gen.arrayCombinator(getType(tpe.args![0], isReadonly, prefix));
    case 'Map':
      return gen.dictionaryCombinator(gen.stringType, getType(tpe.args![1], isReadonly, prefix));
    default:
      if (tpe.args && tpe.args.length > 0) {
        return genericCombinator(tpe, prefix);
      } else {
        return gen.identifier(`${prefix}${tpe.name}`);
      }
  }
}

export type GetModelsOptions = {
  isReadonly: boolean;
  runtime: boolean;
};

function getProperty(member: CaseClassMember, isReadonly: boolean): gen.Property {
  const isOptional = member.tpe.name === 'Option';
  const type = getType(member.tpe, isReadonly);
  return gen.property(member.name, type, isOptional, member.desc);
}

function getNewtype(model: CaseClass): gen.CustomTypeDeclaration {
  const tsType = getType(model.members[0].tpe, false);
  const staticType = gen.printStatic(tsType);
  const runtimeType = gen.printRuntime(tsType);
  return gen.customTypeDeclaration(
    model.name,
    [
      `export function ${model.name}<A>() { return fromNewtype<${model.name}<A>>(${runtimeType}) }`,
      `export function ${lowerFirst(model.name)}Iso<A>() { return iso<${model.name}<A>>() }`
    ].join('\n'),
    `export interface ${model.name}<_A> extends Newtype<'${model.name}', ${staticType}> {}`,
    [staticType]
  );
}

function getDeclarations(
  models: Array<Model>,
  isReadonly: boolean
): Array<gen.TypeDeclaration | gen.CustomTypeDeclaration> {
  return models.map(model => {
    if ('isValueClass' in model && model.isValueClass) {
      return getNewtype(model as CaseClass);
    }
    if (model.hasOwnProperty('values')) {
      const enumClass = model as EnumClass;
      return gen.typeDeclaration(
        model.name,
        gen.keyofCombinator(enumClass.values.map((v: any) => v.name), model.name),
        true,
        false
      );
    }
    const caseClass = model as CaseClass;
    const interfaceDecl = gen.interfaceCombinator(
      caseClass.members.map(member => getProperty(member, isReadonly)),
      model.name
    );
    if (caseClass.typeParams && caseClass.typeParams.length > 0) {
      const staticParams = caseClass.typeParams.map(p => `${p.name} extends t.Any`).join(', ');
      const runtimeParams = caseClass.typeParams.map(p => `${p.name}: ${p.name}`).join(', ');
      const dependencies = interfaceDecl.properties
        .map(p => gen.printStatic(p.type))
        .filter(p => !caseClass.typeParams.map(p => p.name).includes(p));
      return gen.customTypeDeclaration(
        model.name,
        `export interface ${model.name}<${caseClass.typeParams.map(p => p.name)}> ${gen.printStatic(interfaceDecl)}`,
        `export const ${model.name} = <${staticParams}>(${runtimeParams}) => ${gen.printRuntime(interfaceDecl)}`,
        dependencies
      );
    } else {
      return gen.typeDeclaration(
        model.name,
        gen.interfaceCombinator(caseClass.members.map(member => getProperty(member, isReadonly)), model.name),
        true,
        isReadonly
      );
    }
  });
}

const newtypePrelude = `
interface Newtype<URI, A> {
  _URI: URI
  _A: A
}
interface Iso<S, A> {
  unwrap: (s: S) => A
  wrap: (a: A) => S
}
const unsafeCoerce = <A, B>(a: A): B => a as any
type Carrier<N extends Newtype<any, any>> = N['_A']
type AnyNewtype = Newtype<any, any>
const fromNewtype: <N extends AnyNewtype>(type: t.Type<Carrier<N>, t.mixed>) => t.Type<N, t.mixed> =
  type => type as any
const iso = <S extends AnyNewtype>(): Iso<S, Carrier<S>> =>
  ({ wrap: unsafeCoerce, unwrap: unsafeCoerce })

`;

export function getModels(models: Array<Model>, options: GetModelsOptions, prelude: string = ''): string {
  _models = models;
  const declarations = getDeclarations(models, options.isReadonly);
  const newtypeDeclarations: gen.CustomTypeDeclaration[] = declarations.filter(
    (d): d is gen.CustomTypeDeclaration => d.kind === 'CustomTypeDeclaration'
  );
  // const typeDeclarations: gen.TypeDeclaration[] = declarations.filter(
  //   (d): d is gen.TypeDeclaration => d.kind !== 'newtype'
  // );
  const sortedTypeDeclarations = gen.sort(sortBy(declarations, ({ name }) => name));
  let out = ['// DO NOT EDIT MANUALLY - metarpheus-generated', "import * as t from 'io-ts'", '', ''].join('\n');
  if (newtypeDeclarations.length > 0) {
    out += newtypePrelude;
  }
  if (options.runtime) {
    out += prelude;
  }
  out += sortedTypeDeclarations
    .map(d => {
      return options.runtime ? gen.printStatic(d) + '\n\n' + gen.printRuntime(d) : gen.printStatic(d);
    })
    .join('\n\n');
  return out;
}

export type GetRoutesOptions = {
  isReadonly: boolean;
};

function isRouteSegmentString(routeSegment: RouteSegment): routeSegment is RouteSegmentString {
  return routeSegment.hasOwnProperty('str');
}

function isRouteSegmentParam(routeSegment: RouteSegment): routeSegment is RouteSegmentParam {
  return routeSegment.hasOwnProperty('routeParam');
}

function getRoutePath(route: Route): string {
  const path = route.route
    .map(routeSegment => {
      if (isRouteSegmentString(routeSegment)) {
        return routeSegment.str;
      }
      if (isRouteSegmentParam(routeSegment)) {
        return '${' + routeSegment.routeParam.name + '}';
      }
    })
    .join('/');
  return '`${config.apiEndpoint}/' + path + '`';
}

function getRouteParams(route: Route): string {
  let s = '{\n';
  s += route.params
    .filter(param => !param.inBody)
    .map(param => {
      return `          ${param.name}`;
    })
    .join(',\n');
  s += '\n        }';
  return s;
}

function getRouteData(route: Route): string {
  if (route.method === 'post' && route.body) {
    return 'data'; // the name `data` is hardcoded for this param in `getRouteArguments`
  }

  let s = '{\n';
  s += route.params
    .filter(param => param.inBody)
    .map(param => {
      return `          ${param.name}`;
    })
    .join(',\n');
  s += '\n        }';
  return s;
}

function getRouteHeaders(route: Route): string {
  const headers = [{ name: `'Content-Type'`, value: `'application/json'` }];
  if (route.method === 'get') {
    headers.push({ name: `'Pragma'`, value: `'no-cache'` });
    headers.push({ name: `'Cache-Control'`, value: `'no-cache, no-store'` });
  }
  if (route.authenticated) {
    headers.push({ name: `'Authorization'`, value: '`Token token="${token}"`' });
  }
  let s = '{\n';
  s += headers
    .map(header => {
      return `          ${header.name}: ${header.value}`;
    })
    .join(',\n');
  s += '\n        }';
  return s;
}

function getAxiosConfig(route: Route, isReadonly: boolean): string {
  let s = '{';
  s += `\n        method: '${route.method}',`;
  s += `\n        url: ${getRoutePath(route)},`;
  s += `\n        params: ${getRouteParams(route)},`;
  s += `\n        data: ${getRouteData(route)},`;
  s += `\n        headers: ${getRouteHeaders(route)},`;
  s += '\n        timeout: config.timeout';
  s += '\n      }';
  return s;
}

function getRouteArguments(route: Route, isReadonly: boolean): string {
  const params = [
    ...route.params,
    ...route.route
      .filter(isRouteSegmentParam)
      .map(({ routeParam }, index) => ({ ...routeParam, name: routeParam.name || `param${index + 1}` }))
  ].map(param => {
    let type = getType(param.tpe, isReadonly, 'm.');
    if (!param.required) {
      type = gen.unionCombinator([type, gen.undefinedType]);
    }
    return {
      name: param.name,
      type: gen.printStatic(type)
    };
  });
  if (route.authenticated) {
    params.unshift({ name: 'token', type: 'string' });
  }
  if (route.method === 'post' && route.body) {
    const bodyType = getType(route.body.tpe, isReadonly, 'm.');
    // the name `data` for this param is hardcoded in `getRouteData`
    params.push({ name: 'data', type: gen.printStatic(bodyType) });
  }
  if (uniq(params.map(p => p.name)).length !== params.length) {
    throw new Error('Some params have the same name');
  }
  return `{ ${params.map(param => param.name).join(', ')} }: { ${params
    .map(param => `${param.name}: ${param.type}`)
    .join(', ')} }`;
}

function getRoute(_route: Route, isReadonly: boolean): string {
  const segments = _route.route.reduce(
    (acc, s: RouteSegment) => {
      return isRouteSegmentParam(s)
        ? {
            counter: acc.counter + 1,
            segments: [
              ...acc.segments,
              { ...s, routeParam: { ...s.routeParam, name: s.routeParam.name || `param${acc.counter}` } }
            ]
          }
        : { counter: acc.counter, segments: [...acc.segments, s] };
    },
    { counter: 1, segments: [] as RouteSegment[] }
  ).segments;

  const route = { ..._route, route: segments };
  const name = route.name.join('_');
  const returns = getType(route.returns, isReadonly, 'm.');
  let s = route.desc ? `    /** ${route.desc} */\n` : '';
  s += `    ${name}: function (${getRouteArguments(route, isReadonly)}): Promise<${gen.printStatic(returns)}> {`;
  s += `\n      return axios(${getAxiosConfig(route, isReadonly)}).then(res => valueOrThrow(${gen.printRuntime(
    returns
  )}, config.unwrapApiResponse(res.data)), parseError) as any`;
  s += '\n    }';
  return s;
}

const getRoutesPrelude = `// DO NOT EDIT MANUALLY - metarpheus-generated
import axios, { AxiosError } from 'axios'
import * as t from 'io-ts'
import * as m from './model-ts'

export interface RouteConfig {
  apiEndpoint: string,
  timeout: number,
  unwrapApiResponse: (resp: any) => any
}

import { PathReporter } from 'io-ts/lib/PathReporter'
function valueOrThrow<T extends t.Type<any, any>>(iotsType: T, value: T['_I']): t.TypeOf<T> {
  const validatedValue = iotsType.decode(value);

  if (validatedValue.isLeft()) {
    throw new Error(PathReporter.report(validatedValue).join('\\n'));
  }

  return validatedValue.value;
}

const parseError = (err: AxiosError) => {
  try {
    const { errors = [] } = err.response!.data;
    return Promise.reject({ status: err.response!.status, errors });
  } catch (e) {
    return Promise.reject({ status: err && err.response && err.response.status || 0, errors: [] });
  }
};
`;

export function getRoutes(
  routes: Array<Route>,
  models: Array<Model>,
  options: GetRoutesOptions,
  prelude: string = getRoutesPrelude
): string {
  _models = models;
  return (
    prelude +
    `
export default function getRoutes(config: RouteConfig) {
  return {
` +
    routes.map(route => getRoute(route, options.isReadonly)).join(',\n\n') +
    `
  }
}`
  );
}
