export interface Tpe {
  name: string;
  args?: Array<Tpe>;
}

export interface CaseClassMember {
  name: string;
  tpe: Tpe;
  desc?: string;
}

export interface CaseClass {
  _type: 'CaseClass';
  name: string;
  members: Array<CaseClassMember>;
  desc?: string;
  typeParams: Array<Tpe>;
  isValueClass: boolean;
}

export interface EnumValue {
  name: string;
}

export interface Enum {
  _type: 'CaseEnum';
  name: string;
  values: Array<EnumValue>;
}

export interface TaggedUnionValue {
  name: string;
  params: Array<CaseClassMember>;
  desc?: string;
  isValueClass: boolean;
}

export interface TaggedUnion {
  _type: 'TaggedUnion';
  name: string;
  values: Array<TaggedUnionValue>;
}

export type Model = CaseClass | Enum | TaggedUnion;

export interface RouteParam {
  name?: string;
  tpe: Tpe;
  required: boolean;
  desc?: string;
  inBody: boolean;
}

export interface RouteSegmentParam {
  routeParam: RouteParam;
}

export interface RouteSegmentString {
  str: string;
}

export type RouteSegment = RouteSegmentParam | RouteSegmentString;

export interface Body {
  tpe: Tpe;
  desc?: string;
}

export interface BaseRoute {
  route: Array<RouteSegment>;
  params: Array<RouteParam>;
  authenticated: boolean;
  returns: Tpe;
  ctrl: Array<string>;
  desc?: string;
  name: Array<string>;
}

export interface Get extends BaseRoute {
  method: 'get';
}

export interface Post extends BaseRoute {
  method: 'post';
  body?: Body;
}

export type Route = Get | Post;
