export interface Tpe {
  name: string
  args?: Array<Tpe>
}

export type CaseClassMember = {
  name: string
  tpe: Tpe
  desc?: string
}

export type CaseClass = {
  name: string
  members: Array<CaseClassMember>
  desc?: string,
  isValueClass: boolean
}

export type EnumClassValue = {
  name: string
}

export type EnumClass = {
  name: string
  values: Array<EnumClassValue>
}

export type Model = CaseClass | EnumClass

export type RouteParam = {
  name?: string
  tpe: Tpe
  required: boolean
  desc?: string
  inBody: boolean
}

export type RouteSegmentParam = {
  routeParam: RouteParam
}

export type RouteSegmentString = {
  str: string
}

export type RouteSegment = RouteSegmentParam | RouteSegmentString

export type Body = {
  tpe: Tpe
  desc?: string
}

export type BaseRoute = {
  route: Array<RouteSegment>
  params: Array<RouteParam>
  authenticated: boolean
  returns: Tpe
  ctrl: Array<string>
  desc?: string
  name: Array<string>
}

export type Get = BaseRoute & {
  method: 'get'
}

export type Post = BaseRoute & {
  method: 'post'
  body?: Body
}

export type Route = Get | Post
