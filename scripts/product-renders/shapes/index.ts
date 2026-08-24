/**
 * Shape registry: every `artwork` key a seed can reference maps to a
 * renderer. Keys mirror the SHAPES map in
 * src/components/catalog/product-artwork.tsx — the two lists must stay in
 * step, which scripts/generate-product-images.ts asserts at startup.
 */

import type { ShapeRenderer } from '../types'
import {
  ballValve,
  butterflyValve,
  checkValve,
  controlValve,
  gateValve,
  strainer,
} from './valves'
import {
  boosterSet,
  clamp,
  insulation,
  pipe,
  pump,
  pumpDosing,
  pumpSubmersible,
} from './flow'
import { ahu, compressor, fan, fcu, filter } from './climate'
import {
  breaker,
  breakerMcb,
  cableTray,
  contactor,
  distributionBoard,
  motor,
  vfd,
} from './electrical'
import { floSwitch, hose, hydrant, sprinkler } from './fire'
import { clampMeter, flowMeter, gauge, thermometer, transmitter } from './instruments'
import {
  gloves,
  goggles,
  harness,
  helmet,
  hoist,
  torqueWrench,
  wrench,
} from './tools-safety'

export const SHAPE_RENDERERS: Record<string, ShapeRenderer> = {
  'ball-valve': ballValve,
  'butterfly-valve': butterflyValve,
  'gate-valve': gateValve,
  'check-valve': checkValve,
  strainer,
  'control-valve': controlValve,
  'balancing-valve': controlValve,

  pump,
  'pump-submersible': pumpSubmersible,
  'pump-dosing': pumpDosing,
  'booster-set': boosterSet,
  pipe,
  insulation,
  clamp,

  ahu,
  fcu,
  fan,
  filter,
  compressor,

  breaker,
  'breaker-mcb': breakerMcb,
  contactor,
  'distribution-board': distributionBoard,
  'cable-tray': cableTray,
  motor,
  vfd,

  sprinkler,
  hydrant,
  hose,
  'flow-switch': floSwitch,

  gauge,
  thermometer,
  transmitter,
  'flow-meter': flowMeter,
  'clamp-meter': clampMeter,

  'torque-wrench': torqueWrench,
  wrench,
  hoist,
  gloves,
  helmet,
  goggles,
  harness,
}
