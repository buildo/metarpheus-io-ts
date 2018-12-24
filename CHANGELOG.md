#  Change Log



## [v0.6.2](https://github.com/buildo/metarpheus-io-ts/tree/v0.6.2) (2018-12-24)
[Full Changelog](https://github.com/buildo/metarpheus-io-ts/compare/v0.6.1...v0.6.2)

#### Fixes (bugs & defects):

- Fix use of useLegacyNewtype [#73](https://github.com/buildo/metarpheus-io-ts/issues/73)

## [v0.6.1](https://github.com/buildo/metarpheus-io-ts/tree/v0.6.1) (2018-12-24)
[Full Changelog](https://github.com/buildo/metarpheus-io-ts/compare/v0.6.0...v0.6.1)

#### New features:

- Allow legacy serialization of newtype [#71](https://github.com/buildo/metarpheus-io-ts/issues/71)
- Remove custom dictionaryCombinator [#64](https://github.com/buildo/metarpheus-io-ts/issues/64)

## [v0.6.0](https://github.com/buildo/metarpheus-io-ts/tree/v0.6.0) (2018-12-21)
[Full Changelog](https://github.com/buildo/metarpheus-io-ts/compare/v0.5.1...v0.6.0)

#### Fixes (bugs & defects):

- Enum Types become strings when used as map keys [#62](https://github.com/buildo/metarpheus-io-ts/issues/62)

#### Breaking:

- optional values in scala translates wrongly in `io-ts` [#57](https://github.com/buildo/metarpheus-io-ts/issues/57)

#### New features:

- Better integer handling [#7](https://github.com/buildo/metarpheus-io-ts/issues/7)

## [v0.5.1](https://github.com/buildo/metarpheus-io-ts/tree/v0.5.1) (2018-12-17)
[Full Changelog](https://github.com/buildo/metarpheus-io-ts/compare/v0.5.0...v0.5.1)

## [v0.5.0](https://github.com/buildo/metarpheus-io-ts/tree/v0.5.0) (2018-12-17)
[Full Changelog](https://github.com/buildo/metarpheus-io-ts/compare/v0.4.2...v0.5.0)

#### Breaking:

- Instant and UUID should not have an hardcoded override to string [#59](https://github.com/buildo/metarpheus-io-ts/issues/59)

## [v0.4.2](https://github.com/buildo/metarpheus-io-ts/tree/v0.4.2) (2018-12-17)
[Full Changelog](https://github.com/buildo/metarpheus-io-ts/compare/v0.4.1...v0.4.2)

#### Fixes (bugs & defects):

- Containers with optional values are encoded incorrectly [#61](https://github.com/buildo/metarpheus-io-ts/issues/61)

## [v0.4.1](https://github.com/buildo/metarpheus-io-ts/tree/v0.4.1) (2018-07-26)
[Full Changelog](https://github.com/buildo/metarpheus-io-ts/compare/v0.4.0...v0.4.1)

#### Fixes (bugs & defects):

- Authenticated routes missing token parameter [#55](https://github.com/buildo/metarpheus-io-ts/issues/55)

## [v0.4.0](https://github.com/buildo/metarpheus-io-ts/tree/v0.4.0) (2018-07-21)
[Full Changelog](https://github.com/buildo/metarpheus-io-ts/compare/v0.3.0...v0.4.0)

#### New features:

- Use unique symbol for newtype encoding [#54](https://github.com/buildo/metarpheus-io-ts/issues/54)

#### Breaking:

- Generic parameter of newtypes is unused [#53](https://github.com/buildo/metarpheus-io-ts/issues/53)

#### Fixes (bugs & defects):

- Current encoding of fromNewtype breaks in some cases [#52](https://github.com/buildo/metarpheus-io-ts/issues/52)
- Add support for UUID [#51](https://github.com/buildo/metarpheus-io-ts/issues/51)
- Add support for Unit [#50](https://github.com/buildo/metarpheus-io-ts/issues/50)
- Add support for Double [#49](https://github.com/buildo/metarpheus-io-ts/issues/49)

## [v0.3.0](https://github.com/buildo/metarpheus-io-ts/tree/v0.3.0) (2018-07-20)
[Full Changelog](https://github.com/buildo/metarpheus-io-ts/compare/v0.2.3...v0.3.0)

#### Breaking:

- Add support for generics [#48](https://github.com/buildo/metarpheus-io-ts/issues/48)

## [v0.2.3](https://github.com/buildo/metarpheus-io-ts/tree/v0.2.3) (2018-04-13)
[Full Changelog](https://github.com/buildo/metarpheus-io-ts/compare/v0.2.2...v0.2.3)

#### Fixes (bugs & defects):

- fromNewType uses t.Type incorrectly [#43](https://github.com/buildo/metarpheus-io-ts/issues/43)

## [v0.2.2](https://github.com/buildo/metarpheus-io-ts/tree/v0.2.2) (2018-04-09)
[Full Changelog](https://github.com/buildo/metarpheus-io-ts/compare/v0.2.1...v0.2.2)

#### New features:

- update io-ts version [#40](https://github.com/buildo/metarpheus-io-ts/issues/40)

## [v0.2.1](https://github.com/buildo/metarpheus-io-ts/tree/v0.2.1) (2018-03-14)
[Full Changelog](https://github.com/buildo/metarpheus-io-ts/compare/v0.2.0...v0.2.1)

#### Fixes (bugs & defects):

- Typo in newtype code generation [#37](https://github.com/buildo/metarpheus-io-ts/issues/37)

## [v0.2.0](https://github.com/buildo/metarpheus-io-ts/tree/v0.2.0) (2018-03-14)
[Full Changelog](https://github.com/buildo/metarpheus-io-ts/compare/v0.1.14...v0.2.0)

#### Breaking:

- Add support for actual newtypes [#36](https://github.com/buildo/metarpheus-io-ts/issues/36)

## [v0.1.14](https://github.com/buildo/metarpheus-io-ts/tree/v0.1.14) (2018-02-13)
[Full Changelog](https://github.com/buildo/metarpheus-io-ts/compare/v0.1.13...v0.1.14)

## [v0.1.13](https://github.com/buildo/metarpheus-io-ts/tree/v0.1.13) (2018-01-25)
[Full Changelog](https://github.com/buildo/metarpheus-io-ts/compare/v0.1.12...v0.1.13)

#### Fixes (bugs & defects):

- parseError fn is broken [#31](https://github.com/buildo/metarpheus-io-ts/issues/31)

## [v0.1.12](https://github.com/buildo/metarpheus-io-ts/tree/v0.1.12) (2018-01-15)
[Full Changelog](https://github.com/buildo/metarpheus-io-ts/compare/v0.1.11...v0.1.12)

## [v0.1.11](https://github.com/buildo/metarpheus-io-ts/tree/v0.1.11) (2018-01-15)
[Full Changelog](https://github.com/buildo/metarpheus-io-ts/compare/v0.1.10...v0.1.11)

#### New features:

- deserialize api values also in production [#27](https://github.com/buildo/metarpheus-io-ts/issues/27)
- parse errors as we currently expect them [#26](https://github.com/buildo/metarpheus-io-ts/issues/26)

## [v0.1.10](https://github.com/buildo/metarpheus-io-ts/tree/v0.1.10) (2018-01-05)
[Full Changelog](https://github.com/buildo/metarpheus-io-ts/compare/v0.1.9...v0.1.10)

#### New features:

- disable runtime checks in production (perf) [#25](https://github.com/buildo/metarpheus-io-ts/issues/25)

## [v0.1.9](https://github.com/buildo/metarpheus-io-ts/tree/v0.1.9) (2018-01-05)
[Full Changelog](https://github.com/buildo/metarpheus-io-ts/compare/v0.1.8...v0.1.9)

#### New features:

- should support old (pre-wiro) body param type specification [#23](https://github.com/buildo/metarpheus-io-ts/issues/23)
- should allow to override models & routes prelude [#22](https://github.com/buildo/metarpheus-io-ts/issues/22)

## [v0.1.8](https://github.com/buildo/metarpheus-io-ts/tree/v0.1.8) (2018-01-05)
[Full Changelog](https://github.com/buildo/metarpheus-io-ts/compare/v0.1.7...v0.1.8)

#### New features:

- update io-ts-codegen for cleaner static model output [#21](https://github.com/buildo/metarpheus-io-ts/issues/21)

## [v0.1.7](https://github.com/buildo/metarpheus-io-ts/tree/v0.1.7) (2017-12-20)
[Full Changelog](https://github.com/buildo/metarpheus-io-ts/compare/v0.1.6...v0.1.7)

#### New features:

- update unsafeValidate fn to support newer io-ts ^0.9 [#19](https://github.com/buildo/metarpheus-io-ts/issues/19)

## [v0.1.6](https://github.com/buildo/metarpheus-io-ts/tree/v0.1.6) (2017-12-20)
[Full Changelog](https://github.com/buildo/metarpheus-io-ts/compare/v0.1.5...v0.1.6)

#### New features:

- add support for API path params [#17](https://github.com/buildo/metarpheus-io-ts/issues/17)
- Generated APIs should import models from generated model.ts [#15](https://github.com/buildo/metarpheus-io-ts/issues/15)
- Routes config [#13](https://github.com/buildo/metarpheus-io-ts/issues/13)

## [v0.1.5](https://github.com/buildo/metarpheus-io-ts/tree/v0.1.5) (2017-09-29)
[Full Changelog](https://github.com/buildo/metarpheus-io-ts/compare/v0.1.4...v0.1.5)

## [v0.1.4](https://github.com/buildo/metarpheus-io-ts/tree/v0.1.4) (2017-09-29)
[Full Changelog](https://github.com/buildo/metarpheus-io-ts/compare/v0.1.3...v0.1.4)

#### New features:

- Remove buildo-lodash-ts [#11](https://github.com/buildo/metarpheus-io-ts/issues/11)
- enforce a stable sorting for models [#8](https://github.com/buildo/metarpheus-io-ts/issues/8)

## [v0.1.3](https://github.com/buildo/metarpheus-io-ts/tree/v0.1.3) (2017-06-21)
[Full Changelog](https://github.com/buildo/metarpheus-io-ts/compare/v0.1.2...v0.1.3)

## [v0.1.2](https://github.com/buildo/metarpheus-io-ts/tree/v0.1.2) (2017-06-20)
[Full Changelog](https://github.com/buildo/metarpheus-io-ts/compare/v0.1.1...v0.1.2)

#### Fixes (bugs & defects):

- some commonly used generics are not correctly handled [#4](https://github.com/buildo/metarpheus-io-ts/issues/4)

## [v0.1.1](https://github.com/buildo/metarpheus-io-ts/tree/v0.1.1) (2017-06-20)
[Full Changelog](https://github.com/buildo/metarpheus-io-ts/compare/v0.1.0...v0.1.1)

#### Fixes (bugs & defects):

- fix gen-io-ts imports [#2](https://github.com/buildo/metarpheus-io-ts/issues/2)

## [v0.1.0](https://github.com/buildo/metarpheus-io-ts/tree/v0.1.0) (2017-06-20)
[Full Changelog](https://github.com/buildo/metarpheus-io-ts/compare/rm...v0.1.0)

## [rm](https://github.com/buildo/metarpheus-io-ts/tree/rm) (2018-07-20)
