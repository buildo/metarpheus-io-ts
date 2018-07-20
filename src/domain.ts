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
  name: string;
  members: Array<CaseClassMember>;
  desc?: string;
  typeParams: Array<Tpe>;
  isValueClass: boolean;
}

export interface EnumClassValue {
  name: string;
}

export interface EnumClass {
  name: string;
  values: Array<EnumClassValue>;
}

export type Model = CaseClass | EnumClass;

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
