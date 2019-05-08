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
  useLegacyNewtype: boolean;
}

function isNewtype(tpe: Tpe): Reader<Ctx, boolean> {
  return ask<Ctx>().map(({ models }) => models.some(m => m.name === tpe.name && 'isValueClass' in m && m.isValueClass));
}

const traverseReader = array.traverse(reader);

function genericCombinator(tpe: Tpe): Reader<Ctx, gen.CustomCombinator> {
  return ask<Ctx>().chain(({ prefix }) => {
    const type = gen.identifier(`${prefix}${tpe.name}`);
    const staticArgsR = traverseReader(tpe.args!, t => getType(t)).map(typeReferences =>
      typeReferences.map(gen.printStatic).join(', ')
    );
    const runtimeArgsR = traverseReader(tpe.args!, t => getType(t)).map(typeReferences =>
      typeReferences.map(gen.printRuntime).join(', ')
    );
    return staticArgsR.chain(staticArgs =>
      runtimeArgsR.chain(runtimeArgs =>
        isNewtype(tpe).map(newtype =>
          gen.customCombinator(
            `${gen.printStatic(type)}<${staticArgs}>`,
            newtype ? `${gen.printRuntime(type)}<${staticArgs}>()` : `${gen.printRuntime(type)}(${runtimeArgs})`,
            gen.getNodeDependencies(type)
          )
        )
      )
    );
  });
}

function optionCombinator(tpe: Tpe): Reader<Ctx, gen.CustomCombinator> {
  return getType(tpe.args![0]).map(t =>
    gen.customCombinator(
      `Option<${gen.printStatic(t)}>`,
      `createOptionFromNullable(${gen.printRuntime(t)})`,
      gen.getNodeDependencies(t)
    )
  );
}

export function getType(tpe: Tpe): Reader<Ctx, gen.TypeReference> {
  return ask<Ctx>().chain<gen.TypeReference>(({ prefix, isReadonly }) => {
    switch (tpe.name) {
      case 'String':
        return reader.of(gen.stringType);
      case 'Int':
      case 'Long':
        return reader.of(gen.integerType);
      case 'Float':
      case 'Double':
      case 'BigDecimal':
        return reader.of(gen.numberType);
      case 'Boolean':
        return reader.of(gen.booleanType);
      case 'Any':
        return reader.of(gen.unknownType);
      case 'Unit':
        return reader.of(gen.customCombinator('void', `${prefix}VoidFromUnit`));
      case 'Option':
        return optionCombinator(tpe);
      case 'List':
      case 'Set':
      case 'TreeSet':
        return isReadonly
          ? getType(tpe.args![0]).map(gen.readonlyArrayCombinator)
          : getType(tpe.args![0]).map(gen.arrayCombinator);
      case 'Map':
        return getType(tpe.args![0]).chain(keyType =>
          getType(tpe.args![1]).map(valueType => gen.recordCombinator(keyType, valueType))
        );
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
  useLegacyNewtype?: boolean;
}

function getProperty(member: CaseClassMember): Reader<Ctx, gen.Property> {
  return getType(member.tpe).map(type => gen.property(member.name, type, false, member.desc));
}

function getNewtype(model: CaseClass): Reader<Ctx, gen.CustomTypeDeclaration> {
  return ask<Ctx>().chain(({ useLegacyNewtype }) => {
    return getType(model.members[0].tpe).map(tsType => {
      const staticType = gen.printStatic(tsType);
      const runtimeType = gen.printRuntime(tsType);
      const hasTypeParams = model.typeParams && model.typeParams.length > 0;
      const typeParams = hasTypeParams ? `<${model.typeParams.map(t => `${t.name}`).join(', ')}>` : '';
      const dependencies = [staticType];
      const newtypeSymbol = `readonly ${model.name}: unique symbol`;
      const legacyNewtypeSymbol = `readonly ${model.name}: '${model.name}'`;
      const readonlyTypeParams = () =>
        model.typeParams.map(t => `readonly ${model.name}_${t.name}: ${t.name}`).join(', ');
      const staticRepr = hasTypeParams
        ? `export interface ${model.name}${typeParams} extends Newtype<{ ${
            useLegacyNewtype ? legacyNewtypeSymbol : newtypeSymbol
          }, ${readonlyTypeParams()} }, ${staticType}> {}`
        : `export interface ${model.name}${typeParams} extends Newtype<{ ${
            useLegacyNewtype ? legacyNewtypeSymbol : newtypeSymbol
          } }, ${staticType}> {}`;
      const runtimeRepr = hasTypeParams
        ? [
            `export function ${model.name}${typeParams}() { return fromNewtype<${
              model.name
            }${typeParams}>()(${runtimeType}) }`,
            `export function ${lowerFirst(model.name)}Iso${typeParams}() { return iso<${model.name}${typeParams}>() }`
          ].join('\n')
        : [
            `export const ${model.name} = fromNewtype<${model.name}>()(${runtimeType});`,
            `export const ${lowerFirst(model.name)}Iso = iso<${model.name}>();`
          ].join('\n');

      return gen.customTypeDeclaration(model.name, staticRepr, runtimeRepr, dependencies);
    });
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
        const interfaceDecl = gen.typeCombinator(properties, model.name);
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
          return gen.typeDeclaration(model.name, gen.typeCombinator(properties, model.name), true, isReadonly);
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
const fromNewtype = <N extends AnyNewtype>() => <O>(type: t.Type<Carrier<N>, O>): t.Type<N, O> =>
  type as any
const iso = <S extends AnyNewtype>(): Iso<S, Carrier<S>> =>
  ({ wrap: unsafeCoerce, unwrap: unsafeCoerce })

`;

const unitPrelude = `export const VoidFromUnit = new t.Type<void, {}>(
  'VoidFromUnit',
  (_m): _m is void => true,
  () => t.success(undefined),
  () => ({})
)
`;

const ordDeclarations = contramap((d: gen.TypeDeclaration | gen.CustomTypeDeclaration) => d.name, ordString);
const sortDeclarations = sort(ordDeclarations);

export function getModels(models: Array<Model>, options: GetModelsOptions, prelude: string = ''): string {
  const declarations = getDeclarations(models).run({
    models,
    prefix: '',
    isReadonly: options.isReadonly,
    useLegacyNewtype: options.useLegacyNewtype || false
  });
  const hasNewtypeDeclarations = models.some(m => 'isValueClass' in m && m.isValueClass);
  const sortedTypeDeclarations = gen.sort(sortDeclarations(declarations));
  let out = [
    '// DO NOT EDIT MANUALLY - metarpheus-generated',
    "import * as t from 'io-ts'",
    '// @ts-ignore',
    "import { createOptionFromNullable } from 'io-ts-types/lib/fp-ts/createOptionFromNullable'",
    '// @ts-ignore',
    "import { Option } from 'fp-ts/lib/Option'",
    '',
    ''
  ].join('\n');
  if (hasNewtypeDeclarations) {
    out += newtypePrelude;
  }
  if (options.runtime) {
    out += prelude;
    out += unitPrelude;
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
  return '`${_metarpheusRouteConfig.apiEndpoint}/' + path + '`';
}

function getRouteParams(route: Route): Reader<Ctx, string> {
  const routeParams = route.params.filter(param => !param.inBody);
  return traverseReader(routeParams, param =>
    getType(param.tpe).map(type => {
      const paramTpe = param.required ? type : gen.unionCombinator([type, gen.undefinedType]);
      return `          ${param.name}: ${gen.printRuntime(paramTpe)}.encode(${param.name})`;
    })
  ).map(params => {
    return `{\n${params.join(',\n')}\n        }`;
  });
}

function getRouteData(route: Route): Reader<Ctx, string> {
  if (route.method === 'post' && route.body) {
    // the name `data` is hardcoded for this param in `getRouteArguments`
    return getType(route.body.tpe).map(type => `${gen.printRuntime(type)}.encode(data)`);
  }

  const routeParams = route.params.filter(param => param.inBody);
  return traverseReader(routeParams, param =>
    getType(param.tpe).map(type => {
      const paramTpe = param.required ? type : gen.unionCombinator([type, gen.undefinedType]);
      return `          ${param.name}: ${gen.printRuntime(paramTpe)}.encode(${param.name})`;
    })
  ).map(params => {
    return `{\n${params.join(',\n')}\n        }`;
  });
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

function getAxiosConfig(route: Route): Reader<Ctx, string> {
  return getRouteParams(route).chain(routeParams =>
    getRouteData(route).map(routeData => {
      let s = '{';
      s += `\n        method: '${route.method}',`;
      s += `\n        url: ${getRoutePath(route)},`;
      s += `\n        params: ${routeParams},`;
      s += `\n        data: ${routeData},`;
      s += `\n        headers: ${getRouteHeaders(route)},`;
      s += '\n        timeout: _metarpheusRouteConfig.timeout';
      s += '\n      }';
      return s;
    })
  );
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
  const p1 = route.authenticated ? [{ name: 'token', type: 'string' }, ...params] : params;
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
  return ask<Ctx>().chain(() =>
    getType(route.returns).chain(returns =>
      getAxiosConfig(route).chain(axiosConfig =>
        getRouteArguments(route).map(routeArguments => {
          const docs = route.desc ? `    /** ${route.desc} */\n` : '';
          return [
            `${docs}    ${name}: function (${routeArguments}): TaskEither<AxiosError, ${gen.printStatic(returns)}> {`,
            `      return tryCatch(() => axios(${axiosConfig}), identity).map(res =>
              ${gen.printRuntime(returns)}.decode(res.data).getOrElseL(errors => {
                throw new Error(failure(errors).join('\\n'));
              })
            ) as any`,
            '    }'
          ].join('\n');
        })
      )
    )
  );
}

const getRoutesPrelude = `// DO NOT EDIT MANUALLY - metarpheus-generated
import axios, { AxiosError } from 'axios'
import { tryCatch, TaskEither } from 'fp-ts/lib/TaskEither'
import { identity } from 'fp-ts/lib/function'
import * as t from 'io-ts'
import { failure } from 'io-ts/lib/PathReporter'
// @ts-ignore
import { createOptionFromNullable } from 'io-ts-types/lib/fp-ts/createOptionFromNullable'
// @ts-ignore
import { Option } from 'fp-ts/lib/Option'
import * as m from './model-ts'

export interface RouteConfig {
  apiEndpoint: string,
  timeout: number
}
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
export default function getRoutes(_metarpheusRouteConfig: RouteConfig) {
  return {
` +
    routes
      .map(route =>
        getRoute(route).run({ models, prefix: 'm.', isReadonly: options.isReadonly, useLegacyNewtype: false })
      )
      .join(',\n\n') +
    `
  }
}`
  );
}
