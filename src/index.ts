import * as gen from 'io-ts-codegen';
import lowerFirst = require('lodash/lowerFirst');
import { Reader, reader, ask } from 'fp-ts/lib/Reader';
import { array, sort } from 'fp-ts/lib/Array';
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
import { contramap, ordString } from 'fp-ts/lib/Ord';

interface Ctx {
  models: Array<Model>;
  prefix: string;
  isReadonly: boolean;
}

function isNewtype(tpe: Tpe): Reader<Ctx, boolean> {
  return ask<Ctx>().map(({ models }) => models.some(m => m.name === tpe.name && 'isValueClass' in m && m.isValueClass));
}

const traverseReader = array.traverse(reader);

function genericCombinator(tpe: Tpe): Reader<Ctx, gen.CustomCombinator> {
  return ask<Ctx>().chain(({ prefix }) => {
    const type = gen.identifier(`${prefix}${tpe.name}`);
    const staticArgsR = traverseReader(tpe.args!, getType).map(typeReferences =>
      typeReferences.map(gen.printStatic).join(', ')
    );
    const runtimeArgsR = traverseReader(tpe.args!, getType).map(typeReferences =>
      typeReferences.map(gen.printRuntime).join(', ')
    );
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
  });
}

export function getType(tpe: Tpe): Reader<Ctx, gen.TypeReference> {
  return ask<Ctx>().chain(({ prefix, isReadonly }) => {
    switch (tpe.name) {
      case 'String':
      // case 'Date':
      // case 'DateTime':
      case 'Instant':
        return reader.of(gen.stringType);
      case 'Int':
      case 'Float':
      case 'Double':
      case 'BigDecimal':
        return reader.of(gen.numberType);
      case 'Boolean':
        return reader.of(gen.booleanType);
      case 'Any':
        return reader.of(gen.anyType);
      case 'Unit':
        return reader.of(gen.strictCombinator([]));
      case 'Option':
        return getType(tpe.args![0]);
      case 'List':
      case 'Set':
      case 'TreeSet':
        return isReadonly
          ? getType(tpe.args![0]).map(gen.readonlyArrayCombinator)
          : getType(tpe.args![0]).map(gen.arrayCombinator);
      case 'Map':
        return getType(tpe.args![1]).map(t => gen.dictionaryCombinator(gen.stringType, t));
      default:
        if (tpe.args && tpe.args.length > 0) {
          return genericCombinator(tpe);
        }
        return reader.of(gen.identifier(`${prefix}${tpe.name}`));
    }
  });
}

export interface GetModelsOptions {
  isReadonly: boolean;
  runtime: boolean;
}

function getProperty(member: CaseClassMember): Reader<Ctx, gen.Property> {
  const isOptional = member.tpe.name === 'Option';
  return getType(member.tpe).map(type => gen.property(member.name, type, isOptional, member.desc));
}

function getNewtype(model: CaseClass): Reader<Ctx, gen.CustomTypeDeclaration> {
  return getType(model.members[0].tpe).map(tsType => {
    const staticType = gen.printStatic(tsType);
    const runtimeType = gen.printRuntime(tsType);
    const hasTypeParams = model.typeParams && model.typeParams.length > 0;
    const typeParams = hasTypeParams ? `<${model.typeParams.map(t => `_${t.name}`).join(', ')}>` : '';
    const dependencies = [staticType];
    const staticRepr = `export interface ${model.name}${typeParams} extends Newtype<'${model.name}', ${staticType}> {}`;
    const runtimeRepr = hasTypeParams
      ? [
          `export function ${model.name}${typeParams}() { return fromNewtype<${
            model.name
          }${typeParams}>(${runtimeType}) }`,
          `export function ${lowerFirst(model.name)}Iso${typeParams}() { return iso<${model.name}${typeParams}>() }`
        ].join('\n')
      : [
          `export const ${model.name} = fromNewtype<${model.name}>(${runtimeType});`,
          `export const ${lowerFirst(model.name)}Iso = iso<${model.name}>();`
        ].join('\n');

    return gen.customTypeDeclaration(model.name, staticRepr, runtimeRepr, dependencies);
  });
}

function getDeclarations(models: Array<Model>): Reader<Ctx, Array<gen.TypeDeclaration | gen.CustomTypeDeclaration>> {
  return ask<Ctx>().chain(({ isReadonly }) =>
    traverseReader(models, model => {
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
      return traverseReader(caseClass.members, getProperty).map(properties => {
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
      });
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
const fromNewtype: <N extends AnyNewtype>(type: t.Type<Carrier<N>, Carrier<N>>) => t.Type<N, Carrier<N>> =
  type => type as any
const iso = <S extends AnyNewtype>(): Iso<S, Carrier<S>> =>
  ({ wrap: unsafeCoerce, unwrap: unsafeCoerce })

`;

const ordDeclarations = contramap((d: gen.TypeDeclaration | gen.CustomTypeDeclaration) => d.name, ordString);
const sortDeclarations = sort(ordDeclarations);

export function getModels(models: Array<Model>, options: GetModelsOptions, prelude: string = ''): string {
  const declarations = getDeclarations(models).run({
    models,
    prefix: '',
    isReadonly: options.isReadonly
  });
  const hasNewtypeDeclarations = models.some(m => 'isValueClass' in m && m.isValueClass);
  const sortedTypeDeclarations = gen.sort(sortDeclarations(declarations));
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

export interface GetRoutesOptions {
  isReadonly: boolean;
}

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

function getAxiosConfig(route: Route): string {
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

function getRouteArguments(route: Route): Reader<Ctx, string> {
  const paramsR = [
    ...route.params,
    ...route.route
      .filter(isRouteSegmentParam)
      .map(({ routeParam }, index) => ({ ...routeParam, name: routeParam.name || `param${index + 1}` }))
  ];
  return traverseReader(paramsR, param =>
    getType(param.tpe).map(type => {
      const tpe = param.required ? type : gen.unionCombinator([type, gen.undefinedType]);
      return {
        name: param.name,
        type: gen.printStatic(tpe)
      };
    })
  ).chain(params =>
    getParamsToPrint(route, params).map(paramsToPrint => {
      return `{ ${paramsToPrint.map(param => param.name).join(', ')} }: { ${paramsToPrint
        .map(param => `${param.name}: ${param.type}`)
        .join(', ')} }`;
    })
  );
}

interface Param {
  name: string | undefined;
  type: string;
}

function getParamsToPrint(route: Route, params: Array<Param>): Reader<Ctx, Array<Param>> {
  const p1 = route.authenticated ? params.filter(x => !(x.name === 'token' && x.type === 'string')) : params;
  return route.method === 'post' && route.body
    ? getType(route.body.tpe).map(bodyType =>
        // the name `data` for this param is hardcoded in `getRouteData`
        [...p1, { name: 'data', type: gen.printStatic(bodyType) }]
      )
    : reader.of(p1);
}

function getRoute(_route: Route): Reader<Ctx, string> {
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
  return ask<Ctx>().chain(({ isReadonly }) =>
    getType(route.returns).chain(returns =>
      getRouteArguments(route).map(routeArguments => {
        const docs = route.desc ? `    /** ${route.desc} */\n` : '';
        return [
          `${docs}    ${name}: function (${routeArguments}): Promise<${gen.printStatic(returns)}> {`,
          `      return axios(${getAxiosConfig(route)}).then(res => valueOrThrow(${gen.printRuntime(
            returns
          )}, config.unwrapApiResponse(res.data)), parseError) as any`,
          '    }'
        ].join('\n');
      })
    )
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
    routes.map(route => getRoute(route).run({ models, prefix: 'm.', isReadonly: options.isReadonly })).join(',\n\n') +
    `
  }
}`
  );
}
