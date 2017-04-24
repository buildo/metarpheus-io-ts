import * as t from 'io-ts'

export interface Tpe {
  name: string,
  args?: Array<Tpe>
}

export const Tpe = t.recursion<Tpe>('Tpe', Self => t.interface({
  name: t.string,
  args: t.union([t.array(Self), t.undefined])
}))

export const Desc = t.union([t.string, t.undefined])

export const CaseClassMember = t.interface({
  name: t.string,
  tpe: Tpe,
  desc: Desc
}, 'CaseClassMember')

export type CaseClassMember = t.TypeOf<typeof CaseClassMember>

export const CaseClass = t.interface({
  name: t.string,
  members: t.array(CaseClassMember),
  desc: Desc
}, 'CaseClass')

export type CaseClass = t.TypeOf<typeof CaseClass>

export const EnumClassValue = t.interface({
  name: t.string
}, 'EnumClassValue')

export type EnumClassValue = t.TypeOf<typeof EnumClassValue>

export const EnumClassRT = t.interface({
  name: t.string,
  values: t.array(EnumClassValue)
}, 'EnumClass')

export type EnumClass = t.TypeOf<typeof EnumClassRT>

export const Model = t.union([CaseClass, EnumClassRT], 'Model')

export type Model = t.TypeOf<typeof Model>

export const RouteParam = t.interface({
  name: t.union([t.string, t.undefined]),
  tpe: Tpe,
  required: t.boolean,
  desc: Desc,
  inBody: t.boolean
})

export const RouteSegmentParam = t.interface({
  routeParam: RouteParam
})

export type RouteSegmentParam = t.TypeOf<typeof RouteSegmentParam>

export const RouteSegmentString = t.interface({
  str: t.string
})

export type RouteSegmentString = t.TypeOf<typeof RouteSegmentString>

export const RouteSegment = t.union([RouteSegmentParam, RouteSegmentString])

export type RouteSegment = t.TypeOf<typeof RouteSegment>

export const Body = t.interface({
  tpe: Tpe,
  desc: Desc
})

export const BaseRoute = t.interface({
  route: t.array(RouteSegment),
  params: t.array(RouteParam),
  authenticated: t.boolean,
  returns: Tpe,
  ctrl: t.array(t.string),
  desc: Desc,
  name: t.array(t.string)
})

export const Get = t.intersection([BaseRoute, t.interface({
  method: t.literal('get')
})], 'Get')

export const Post = t.intersection([BaseRoute, t.interface({
  method: t.literal('post'),
  body: t.union([Body, t.undefined])
})], 'Post')

export const Route = t.union([Get, Post], 'Route')

export type Route = t.TypeOf<typeof Route>
