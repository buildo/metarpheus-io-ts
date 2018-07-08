import * as gen from 'io-ts-codegen';
import sortBy = require('lodash/sortBy');
import lowerFirst = require('lodash/lowerFirst');
import { Reader, reader, ask } from 'fp-ts/lib/Reader';
import { array } from 'fp-ts/lib/Array';
import { sequence } from 'fp-ts/lib/Traversable';
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

type Models = Array<Model>;

function isNewtype(tpe: Tpe): Reader<Models, boolean> {
  return ask<Models>().map(models => {
    const model = models.find(m => m.name === tpe.name);
    return !!(model && 'isValueClass' in model && model.isValueClass);
  });
}

function genericCombinator(tpe: Tpe, prefix: string): Reader<Models, gen.CustomCombinator> {
  const type = gen.identifier(`${prefix}${tpe.name}`);
  const staticArgsR = sequence(reader, array)(
    tpe.args!.map(arg => getType(arg, false, prefix).map(gen.printStatic))
  ).map(args => args.join(', '));
  const runtimeArgsR = sequence(reader, array)(
    tpe.args!.map(arg => getType(arg, false, prefix).map(gen.printRuntime))
  ).map(args => args.join(', '));

  return staticArgsR.chain(staticArgs =>
    runtimeArgsR.chain(runtimeArgs =>
      isNewtype(tpe).map(newtype =>
        gen.customCombinator(
          `${gen.printStatic(type)}<${staticArgs}>`,
          newtype ? `${gen.printRuntime(type)}<${staticArgs}>()` : `${gen.printRuntime(type)}(${runtimeArgs})`,
          []
        )
      )
    )
  );
}

export function getType(tpe: Tpe, isReadonly: boolean, prefix: string = ''): Reader<Models, gen.TypeReference> {
  switch (tpe.name) {
    case 'String':
    // case 'Date':
    // case 'DateTime':
    case 'Instant':
      return reader.of(gen.stringType);
    case 'Int':
    case 'Float':
    case 'BigDecimal':
      return reader.of(gen.numberType);
    case 'Boolean':
      return reader.of(gen.booleanType);
    case 'Any':
      return reader.of(gen.anyType);
    case 'Option':
      return getType(tpe.args![0], isReadonly, prefix);
    case 'List':
    case 'Set':
    case 'TreeSet':
      return isReadonly
        ? getType(tpe.args![0], isReadonly, prefix).map(gen.readonlyArrayCombinator)
        : getType(tpe.args![0], isReadonly, prefix).map(gen.arrayCombinator);
    case 'Map':
      return getType(tpe.args![1], isReadonly, prefix).map(t => gen.dictionaryCombinator(gen.stringType, t));
    default:
      if (tpe.args && tpe.args.length > 0) {
        return genericCombinator(tpe, prefix);
      }
      return reader.of(gen.identifier(`${prefix}${tpe.name}`));
  }
}

export type GetModelsOptions = {
  isReadonly: boolean;
  runtime: boolean;
};

function getProperty(member: CaseClassMember, isReadonly: boolean): Reader<Models, gen.Property> {
  const isOptional = member.tpe.name === 'Option';
  return getType(member.tpe, isReadonly).map(type => gen.property(member.name, type, isOptional, member.desc));
}

function getNewtype(model: CaseClass): Reader<Models, gen.CustomTypeDeclaration> {
  return getType(model.members[0].tpe, false).map(tsType => {
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
  });
}

function getDeclarations(
  models: Array<Model>,
  isReadonly: boolean
): Reader<Models, Array<gen.TypeDeclaration | gen.CustomTypeDeclaration>> {
  return sequence(reader, array)(
    models.map(model => {
      if ('isValueClass' in model && model.isValueClass) {
        return getNewtype(model as CaseClass);
      }
      if (model.hasOwnProperty('values')) {
        const enumClass = model as EnumClass;
        return reader.of(
          gen.typeDeclaration(
            model.name,
            gen.keyofCombinator(enumClass.values.map((v: any) => v.name), model.name),
            true,
            false
          )
        );
      }
      const caseClass = model as CaseClass;
      return sequence(reader, array)(caseClass.members.map(member => getProperty(member, isReadonly))).map(
        properties => {
          const interfaceDecl = gen.interfaceCombinator(properties, model.name);
          if (caseClass.typeParams && caseClass.typeParams.length > 0) {
            const staticParams = caseClass.typeParams.map(p => `${p.name} extends t.Any`).join(', ');
            const runtimeParams = caseClass.typeParams.map(p => `${p.name}: ${p.name}`).join(', ');
            const dependencies = interfaceDecl.properties
              .map(p => gen.printStatic(p.type))
              .filter(p => !caseClass.typeParams.map(p => p.name).includes(p));
            return gen.customTypeDeclaration(
              model.name,
              `export interface ${model.name}<${caseClass.typeParams.map(p => p.name)}> ${gen.printStatic(
                interfaceDecl
              )}`,
              `export const ${model.name} = <${staticParams}>(${runtimeParams}) => ${gen.printRuntime(interfaceDecl)}`,
              dependencies
            );
          } else {
            return gen.typeDeclaration(model.name, gen.interfaceCombinator(properties, model.name), true, isReadonly);
          }
        }
      );
    })
  );
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
  const declarations = getDeclarations(models, options.isReadonly).run(models);
  const hasNewtypeDeclarations = models.some(m => 'isValueClass' in m && m.isValueClass);
  const sortedTypeDeclarations = gen.sort(sortBy(declarations, ({ name }) => name));
  let out = ['// DO NOT EDIT MANUALLY - metarpheus-generated', "import * as t from 'io-ts'", '', ''].join('\n');
  if (hasNewtypeDeclarations) {
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

function getRouteArguments(route: Route, isReadonly: boolean): Reader<Models, string> {
  const paramsR = [
    ...route.params,
    ...route.route
      .filter(isRouteSegmentParam)
      .map(({ routeParam }, index) => ({ ...routeParam, name: routeParam.name || `param${index + 1}` }))
  ].map(param => {
    return getType(param.tpe, isReadonly, 'm.').map(type => {
      const tpe = param.required ? type : gen.unionCombinator([type, gen.undefinedType]);
      return {
        name: param.name,
        type: gen.printStatic(tpe)
      };
    });
  });
  return sequence(reader, array)(paramsR).chain(params =>
    getParamsToPrint(route, params, isReadonly).map(paramsToPrint => {
      return `{ ${paramsToPrint.map(param => param.name).join(', ')} }: { ${paramsToPrint
        .map(param => `${param.name}: ${param.type}`)
        .join(', ')} }`;
    })
  );
}

type Param = { name: string | undefined; type: string };
function getParamsToPrint(route: Route, params: Array<Param>, isReadonly: boolean): Reader<Models, Array<Param>> {
  const p1 = route.authenticated ? params.filter(x => !(x.name === 'token' && x.type === 'string')) : params;
  return route.method === 'post' && route.body
    ? getType(route.body.tpe, isReadonly, 'm.').map(bodyType =>
        // the name `data` for this param is hardcoded in `getRouteData`
        [...p1, { name: 'data', type: gen.printStatic(bodyType) }]
      )
    : reader.of(p1);
}

function getRoute(_route: Route, isReadonly: boolean): Reader<Models, string> {
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
  return getType(route.returns, isReadonly, 'm.').chain(returns =>
    getRouteArguments(route, isReadonly).map(routeArguments => {
      const docs = route.desc ? `    /** ${route.desc} */\n` : '';
      return [
        `${docs}    ${name}: function (${routeArguments}): Promise<${gen.printStatic(returns)}> {`,
        `      return axios(${getAxiosConfig(route, isReadonly)}).then(res => valueOrThrow(${gen.printRuntime(
          returns
        )}, config.unwrapApiResponse(res.data)), parseError) as any`,
        '    }'
      ].join('\n');
    })
  );
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
  return (
    prelude +
    `
export default function getRoutes(config: RouteConfig) {
  return {
` +
    routes.map(route => getRoute(route, options.isReadonly).run(models)).join(',\n\n') +
    `
  }
}`
  );
}
