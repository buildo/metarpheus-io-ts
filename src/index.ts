import * as gen from 'gen-io-ts'
import * as t from 'io-ts'
import { ValidationError } from 'io-ts'
import { Either } from 'fp-ts/lib/Either'

export interface Tpe {
  name: string,
  args?: Array<Tpe>
}

export const Desc = t.union([t.string, t.undefined])

export const TpeRT = t.recursion<Tpe>('Tpe', Self => t.interface({
  name: t.string,
  args: t.union([t.array(Self), t.undefined])
}))

export const CaseClassMemberRT = t.interface({
  name: t.string,
  tpe: TpeRT,
  desc: Desc
}, 'CaseClassMember')

export type CaseClassMember = t.TypeOf<typeof CaseClassMemberRT>

export const CaseClassRT = t.interface({
  name: t.string,
  members: t.array(CaseClassMemberRT),
  desc: Desc
}, 'CaseClass')

export type CaseClass = t.TypeOf<typeof CaseClassRT>

export const EnumClassValueRT = t.interface({
  name: t.string
}, 'EnumClassValue')

export type EnumClassValue = t.TypeOf<typeof EnumClassValueRT>

export const EnumClassRT = t.interface({
  name: t.string,
  values: t.array(EnumClassValueRT)
}, 'EnumClass')

export type EnumClass = t.TypeOf<typeof EnumClassRT>

export const ModelRT = t.union([CaseClassRT, EnumClassRT], 'Model')

export type Model = t.TypeOf<typeof ModelRT>

export const OptionsRT = t.interface({
  source: t.array(ModelRT)
})

export type Options = t.TypeOf<typeof OptionsRT>

function getType(tpe: Tpe): gen.TypeReference {
  switch (tpe.name) {
    case 'String' :
    case 'Date' :
    case 'DateTime' :
      return gen.stringType
    case 'Int' :
    case 'Float' :
      return gen.numberType
    case 'Boolean' :
      return gen.booleanType
    case 'Option' :
      return getType(tpe.args![0])
    case 'List' :
      return gen.arrayCombinator(getType(tpe.args![0]))
    case 'Map' :
      return gen.dictionaryCombinator(getType(tpe.args![0]), getType(tpe.args![1]))
    default :
      return gen.identifier(tpe.name)
  }
}

function getProperty(member: CaseClassMember): gen.Property {
  const isOptional = member.tpe.name === 'Option'
  return gen.property(member.name, getType(member.tpe), isOptional, member.desc)
}

function getDeclarations(models: Array<Model>): Array<gen.TypeDeclaration> {
  return models.map(model => {
    if (model.hasOwnProperty('values')) {
      const enumClass = model as EnumClass
      return gen.typeDeclaration(
        model.name,
        gen.enumCombinator(enumClass.values.map((v: any) => v.name)),
        true
      )
    }
    const caseClass = model as CaseClass
    return gen.typeDeclaration(
      model.name,
      gen.interfaceCombinator(caseClass.members.map(getProperty)),
      true
    )
  })
}

const prelude = `// DO NOT EDIT MANUALLY - metarpheus-generated\nimport * as t from 'io-ts'\n\n`

export function getModels(options: Options): Either<Array<ValidationError>, string> {
  return t.validate(options, OptionsRT).map(options => {
    const declarations = getDeclarations(options.source)
    const sortedDeclarations = gen.sort(declarations)
    return prelude + sortedDeclarations.map(d => gen.printStatic(d) + '\n\n' + gen.printRuntime(d)).join('\n\n')
  })
}
