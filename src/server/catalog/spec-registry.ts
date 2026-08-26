import type {
  ApplicationDefinition,
  SpecDefinition,
  SpecEnumValue,
} from '@/lib/domain/catalog'

/**
 * The specification registry.
 *
 * This file is the vocabulary of the entire product. It drives four things:
 *
 *   1. Facets on the listing page      (isFilterable)
 *   2. Rows in the comparison grid     (isComparable)
 *   3. Offline intent parsing          (enumValues[].synonyms)
 *   4. The specMatch score component   (rankWeight, compatibleWith)
 *
 * Adding a spec here makes it filterable, comparable, searchable in natural
 * language, and rankable — with no other code change. That is deliberate:
 * new product categories should be a data problem, not an engineering one.
 */

/* -------------------------------------------------------------------------- */
/* Shared enum vocabularies                                                   */
/* -------------------------------------------------------------------------- */

const MATERIALS: SpecEnumValue[] = [
  {
    value: 'stainless_steel',
    label: 'Stainless Steel',
    synonyms: ['ss', 'ss304', 'ss 304', 'ss-304', 'ss316', 'ss 316', 'ss-316', 'stainless', 'inox', 's.s.', 'ss202'],
    // A buyer asking for stainless will usually accept bronze or forged steel
    // for the same duty; they will not accept plastic.
    compatibleWith: ['bronze', 'forged_steel'],
  },
  {
    value: 'cast_iron',
    label: 'Cast Iron',
    synonyms: ['ci', 'cast iron', 'c.i.', 'grey iron'],
    compatibleWith: ['ductile_iron'],
  },
  {
    value: 'ductile_iron',
    label: 'Ductile Iron',
    synonyms: ['di', 'ductile', 'sg iron', 's.g. iron', 'nodular iron'],
    compatibleWith: ['cast_iron'],
  },
  {
    value: 'brass',
    label: 'Brass',
    synonyms: ['brass', 'is 319 brass'],
    compatibleWith: ['bronze'],
  },
  {
    value: 'bronze',
    label: 'Bronze',
    synonyms: ['bronze', 'gunmetal', 'gun metal', 'lead tin bronze'],
    compatibleWith: ['brass', 'stainless_steel'],
  },
  {
    value: 'carbon_steel',
    label: 'Carbon Steel',
    synonyms: ['cs', 'carbon steel', 'ms', 'mild steel', 'a105', 'wcb'],
    compatibleWith: ['forged_steel', 'ductile_iron'],
  },
  {
    value: 'forged_steel',
    label: 'Forged Steel',
    synonyms: ['forged steel', 'fs', 'forged'],
    compatibleWith: ['carbon_steel', 'stainless_steel'],
  },
  {
    value: 'copper',
    label: 'Copper',
    synonyms: ['copper', 'cu', 'is 191 copper'],
    compatibleWith: ['brass'],
  },
  {
    value: 'aluminium',
    label: 'Aluminium',
    synonyms: ['aluminium', 'aluminum', 'al', 'alloy'],
  },
  {
    value: 'upvc',
    label: 'uPVC',
    synonyms: ['upvc', 'u-pvc', 'pvc', 'plastic', 'unplasticised pvc'],
    compatibleWith: ['cpvc', 'ppr'],
  },
  {
    value: 'cpvc',
    label: 'CPVC',
    synonyms: ['cpvc', 'c-pvc', 'chlorinated pvc'],
    compatibleWith: ['upvc', 'ppr'],
  },
  {
    value: 'ppr',
    label: 'PPR',
    synonyms: ['ppr', 'pp-r', 'polypropylene'],
    compatibleWith: ['cpvc', 'upvc'],
  },
  {
    value: 'galvanised_iron',
    label: 'Galvanised Iron',
    synonyms: ['gi', 'g.i.', 'galvanised', 'galvanized', 'galvanised iron'],
    compatibleWith: ['carbon_steel'],
  },
  {
    value: 'hdpe',
    label: 'HDPE',
    synonyms: ['hdpe', 'polyethylene', 'pe100', 'pe 100'],
    compatibleWith: ['upvc'],
  },
]

const CONNECTION_TYPES: SpecEnumValue[] = [
  {
    value: 'threaded',
    label: 'Threaded',
    synonyms: ['threaded', 'thread', 'screwed', 'bsp', 'npt', 'bspt', 'bspp', 'female threaded', 'male threaded'],
    compatibleWith: ['compression'],
  },
  {
    value: 'flanged',
    label: 'Flanged',
    synonyms: ['flanged', 'flange', 'ansi flange', 'din flange', 'pn16 flange', 'bs flange'],
    compatibleWith: ['wafer'],
  },
  {
    value: 'wafer',
    label: 'Wafer',
    synonyms: ['wafer', 'wafer type', 'lug', 'lugged'],
    compatibleWith: ['flanged'],
  },
  {
    value: 'welded',
    label: 'Welded',
    synonyms: ['welded', 'butt weld', 'socket weld', 'bw', 'sw'],
  },
  {
    value: 'grooved',
    label: 'Grooved',
    synonyms: ['grooved', 'victaulic', 'roll groove'],
    compatibleWith: ['flanged'],
  },
  {
    value: 'compression',
    label: 'Compression',
    synonyms: ['compression', 'compression fitting', 'ferrule'],
    compatibleWith: ['threaded'],
  },
  {
    value: 'solvent_weld',
    label: 'Solvent Weld',
    synonyms: ['solvent weld', 'solvent cement', 'glued', 'socket fusion'],
  },
  {
    value: 'brazed',
    label: 'Brazed / Soldered',
    synonyms: ['brazed', 'soldered', 'sweat', 'capillary'],
  },
]

const VALVE_TYPES: SpecEnumValue[] = [
  {
    value: 'ball',
    label: 'Ball Valve',
    synonyms: ['ball valve', 'ball', '2 piece ball', '3 piece ball', 'isolation valve'],
    compatibleWith: ['butterfly', 'gate'],
  },
  {
    value: 'butterfly',
    label: 'Butterfly Valve',
    synonyms: ['butterfly valve', 'butterfly', 'bfv'],
    compatibleWith: ['ball', 'gate'],
  },
  {
    value: 'gate',
    label: 'Gate Valve',
    synonyms: ['gate valve', 'gate', 'sluice valve'],
    compatibleWith: ['ball', 'butterfly'],
  },
  {
    value: 'globe',
    label: 'Globe Valve',
    synonyms: ['globe valve', 'globe', 'regulating valve'],
    compatibleWith: ['balancing'],
  },
  {
    value: 'check',
    label: 'Check Valve',
    synonyms: ['check valve', 'nrv', 'non return valve', 'non-return', 'one way valve', 'dual plate check'],
  },
  {
    value: 'balancing',
    label: 'Balancing Valve',
    synonyms: ['balancing valve', 'balancing', 'double regulating', 'drv', 'commissioning set'],
    compatibleWith: ['globe'],
  },
  {
    value: 'pressure_reducing',
    label: 'Pressure Reducing Valve',
    synonyms: ['pressure reducing valve', 'prv', 'pressure regulator', 'reducing valve'],
  },
  {
    value: 'safety_relief',
    label: 'Safety Relief Valve',
    synonyms: ['safety valve', 'relief valve', 'srv', 'pressure relief'],
  },
  {
    value: 'motorised',
    label: 'Motorised Control Valve',
    synonyms: ['motorised valve', 'motorized valve', 'actuated valve', 'control valve', 'mov', '2 way control valve'],
  },
  {
    value: 'strainer',
    label: 'Y-Strainer',
    synonyms: ['strainer', 'y strainer', 'y-strainer', 'pot strainer', 'filter valve'],
  },
]

const OPERATION_TYPES: SpecEnumValue[] = [
  { value: 'manual_lever', label: 'Manual — Lever', synonyms: ['lever', 'manual', 'hand lever', 'handle'] },
  { value: 'manual_gear', label: 'Manual — Gear Operated', synonyms: ['gear operated', 'gearbox', 'worm gear', 'hand wheel', 'handwheel'] },
  { value: 'electric_actuator', label: 'Electric Actuator', synonyms: ['electric actuator', 'motorised', 'motorized', 'electrically actuated'] },
  { value: 'pneumatic_actuator', label: 'Pneumatic Actuator', synonyms: ['pneumatic', 'air actuated', 'pneumatically operated'] },
  { value: 'automatic', label: 'Automatic', synonyms: ['automatic', 'self acting', 'self-acting'] },
]

const IP_RATINGS: SpecEnumValue[] = [
  { value: 'ip20', label: 'IP20', synonyms: ['ip20', 'ip 20'] },
  { value: 'ip54', label: 'IP54', synonyms: ['ip54', 'ip 54'] },
  { value: 'ip55', label: 'IP55', synonyms: ['ip55', 'ip 55'] },
  { value: 'ip65', label: 'IP65', synonyms: ['ip65', 'ip 65', 'weatherproof'] },
  { value: 'ip66', label: 'IP66', synonyms: ['ip66', 'ip 66'] },
  { value: 'ip67', label: 'IP67', synonyms: ['ip67', 'ip 67', 'submersible rated'] },
  { value: 'ip68', label: 'IP68', synonyms: ['ip68', 'ip 68', 'fully submersible'] },
]

const PHASES: SpecEnumValue[] = [
  { value: 'single_phase', label: 'Single Phase', synonyms: ['single phase', '1 phase', '1-phase', '1ph', '230v', '240v'] },
  { value: 'three_phase', label: 'Three Phase', synonyms: ['three phase', '3 phase', '3-phase', '3ph', '415v', '440v'] },
]

/* -------------------------------------------------------------------------- */
/* Spec definitions                                                           */
/* -------------------------------------------------------------------------- */

/**
 * `rankWeight` is relative importance inside the specMatch component. Material
 * and type are weighted highest because getting those wrong makes a product
 * unusable; finish or weight are informational.
 *
 * `isCritical` marks a spec the assistant may ask a follow-up question about
 * when the buyer omitted it.
 */
export const SPEC_DEFINITIONS: SpecDefinition[] = [
  /* ---- Universal ---- */
  {
    key: 'material',
    label: 'Material',
    dataType: 'enum',
    group: 'construction',
    enumValues: MATERIALS,
    isFilterable: true,
    isComparable: true,
    isCritical: true,
    rankWeight: 1.0,
    categoryKeys: [],
    hint: 'Body or primary wetted material.',
  },
  {
    key: 'weight_kg',
    label: 'Weight',
    dataType: 'number',
    group: 'dimensions',
    unit: 'kg',
    isFilterable: false,
    isComparable: true,
    isCritical: false,
    rankWeight: 0.15,
    categoryKeys: [],
  },

  /* ---- Flow products: valves, pumps, pipes ---- */
  {
    key: 'valve_type',
    label: 'Valve Type',
    dataType: 'enum',
    group: 'construction',
    enumValues: VALVE_TYPES,
    isFilterable: true,
    isComparable: true,
    isCritical: true,
    rankWeight: 1.0,
    categoryKeys: ['valves'],
  },
  {
    key: 'connection_type',
    label: 'Connection',
    dataType: 'enum',
    group: 'connection',
    enumValues: CONNECTION_TYPES,
    isFilterable: true,
    isComparable: true,
    isCritical: true,
    rankWeight: 0.9,
    categoryKeys: ['valves', 'plumbing', 'pumps', 'fire-fighting'],
    hint: 'How the item joins the pipeline.',
  },
  {
    key: 'size_dn',
    label: 'Nominal Size',
    dataType: 'number',
    group: 'dimensions',
    unit: 'DN',
    isFilterable: true,
    isComparable: true,
    isCritical: true,
    rankWeight: 0.95,
    categoryKeys: ['valves', 'plumbing', 'pumps', 'fire-fighting'],
    hint: 'Nominal bore in millimetres. DN50 is 2 inch.',
  },
  {
    key: 'pressure_rating_bar',
    label: 'Pressure Rating',
    dataType: 'number',
    group: 'performance',
    unit: 'bar',
    isFilterable: true,
    isComparable: true,
    isCritical: false,
    rankWeight: 0.75,
    categoryKeys: ['valves', 'plumbing', 'pumps', 'fire-fighting', 'instrumentation', 'industrial'],
  },
  {
    key: 'temperature_max_c',
    label: 'Max Temperature',
    dataType: 'number',
    group: 'performance',
    unit: '°C',
    isFilterable: true,
    isComparable: true,
    isCritical: false,
    rankWeight: 0.5,
    categoryKeys: ['valves', 'plumbing', 'hvac', 'fire-fighting'],
  },
  {
    key: 'operation',
    label: 'Operation',
    dataType: 'enum',
    group: 'construction',
    enumValues: OPERATION_TYPES,
    isFilterable: true,
    isComparable: true,
    isCritical: false,
    rankWeight: 0.6,
    categoryKeys: ['valves'],
  },
  {
    key: 'seat_material',
    label: 'Seat Material',
    dataType: 'text',
    group: 'construction',
    isFilterable: false,
    isComparable: true,
    isCritical: false,
    rankWeight: 0.3,
    categoryKeys: ['valves'],
  },

  /* ---- Pumps ---- */
  {
    key: 'flow_rate_m3h',
    label: 'Flow Rate',
    dataType: 'number',
    group: 'performance',
    unit: 'm³/h',
    isFilterable: true,
    isComparable: true,
    isCritical: true,
    rankWeight: 0.95,
    categoryKeys: ['pumps'],
  },
  {
    key: 'head_m',
    label: 'Head',
    dataType: 'number',
    group: 'performance',
    unit: 'm',
    isFilterable: true,
    isComparable: true,
    isCritical: true,
    rankWeight: 0.9,
    categoryKeys: ['pumps'],
    hint: 'Total dynamic head the pump can deliver.',
  },
  {
    key: 'power_kw',
    label: 'Motor Power',
    dataType: 'number',
    group: 'electrical',
    unit: 'kW',
    isFilterable: true,
    isComparable: true,
    isCritical: false,
    rankWeight: 0.6,
    categoryKeys: ['pumps', 'hvac', 'tools', 'industrial'],
  },
  {
    key: 'phase',
    label: 'Supply',
    dataType: 'enum',
    group: 'electrical',
    enumValues: PHASES,
    isFilterable: true,
    isComparable: true,
    isCritical: false,
    rankWeight: 0.7,
    categoryKeys: ['pumps', 'hvac', 'electrical', 'tools', 'industrial'],
  },

  /* ---- Electrical ---- */
  {
    key: 'current_rating_a',
    label: 'Current Rating',
    dataType: 'number',
    group: 'electrical',
    unit: 'A',
    isFilterable: true,
    isComparable: true,
    isCritical: true,
    rankWeight: 1.0,
    categoryKeys: ['electrical'],
  },
  {
    key: 'breaking_capacity_ka',
    label: 'Breaking Capacity',
    dataType: 'number',
    group: 'electrical',
    unit: 'kA',
    isFilterable: true,
    isComparable: true,
    isCritical: true,
    rankWeight: 0.85,
    categoryKeys: ['electrical'],
    hint: 'Short-circuit current the device can interrupt safely.',
  },
  {
    key: 'poles',
    label: 'Poles',
    dataType: 'number',
    group: 'electrical',
    unit: 'P',
    isFilterable: true,
    isComparable: true,
    isCritical: true,
    rankWeight: 0.8,
    categoryKeys: ['electrical'],
  },
  {
    key: 'voltage_v',
    label: 'Rated Voltage',
    dataType: 'number',
    group: 'electrical',
    unit: 'V',
    isFilterable: true,
    isComparable: true,
    isCritical: false,
    rankWeight: 0.6,
    categoryKeys: ['electrical', 'hvac', 'pumps'],
  },
  {
    key: 'ip_rating',
    label: 'Ingress Protection',
    dataType: 'enum',
    group: 'compliance',
    enumValues: IP_RATINGS,
    isFilterable: true,
    isComparable: true,
    isCritical: false,
    rankWeight: 0.5,
    categoryKeys: ['electrical', 'pumps', 'hvac', 'safety', 'industrial'],
  },

  /* ---- HVAC ---- */
  {
    key: 'cooling_capacity_tr',
    label: 'Cooling Capacity',
    dataType: 'number',
    group: 'performance',
    unit: 'TR',
    isFilterable: true,
    isComparable: true,
    isCritical: true,
    rankWeight: 1.0,
    categoryKeys: ['hvac'],
    hint: '1 TR (ton of refrigeration) ≈ 3.5 kW of cooling.',
  },
  {
    key: 'airflow_cmh',
    label: 'Airflow',
    dataType: 'number',
    group: 'performance',
    unit: 'm³/h',
    isFilterable: true,
    isComparable: true,
    isCritical: false,
    rankWeight: 0.7,
    categoryKeys: ['hvac'],
  },
  {
    key: 'refrigerant',
    label: 'Refrigerant',
    dataType: 'text',
    group: 'performance',
    isFilterable: true,
    isComparable: true,
    isCritical: false,
    rankWeight: 0.45,
    categoryKeys: ['hvac'],
  },
  {
    key: 'filter_class',
    label: 'Filter Class',
    dataType: 'text',
    group: 'performance',
    isFilterable: true,
    isComparable: true,
    isCritical: false,
    rankWeight: 0.4,
    categoryKeys: ['hvac'],
  },

  /* ---- Fire fighting ---- */
  {
    key: 'k_factor',
    label: 'K-Factor',
    dataType: 'number',
    group: 'performance',
    unit: 'K',
    isFilterable: true,
    isComparable: true,
    isCritical: false,
    rankWeight: 0.7,
    categoryKeys: ['fire-fighting'],
    hint: 'Discharge coefficient — governs flow at a given pressure.',
  },
  {
    key: 'temperature_rating_c',
    label: 'Bulb Rating',
    dataType: 'number',
    group: 'performance',
    unit: '°C',
    isFilterable: true,
    isComparable: true,
    isCritical: true,
    rankWeight: 0.8,
    categoryKeys: ['fire-fighting'],
  },
  {
    key: 'response_type',
    label: 'Response',
    dataType: 'text',
    group: 'performance',
    isFilterable: true,
    isComparable: true,
    isCritical: false,
    rankWeight: 0.5,
    categoryKeys: ['fire-fighting'],
  },

  /* ---- Plumbing / piping ---- */
  {
    key: 'outer_diameter_mm',
    label: 'Outer Diameter',
    dataType: 'number',
    group: 'dimensions',
    unit: 'mm',
    isFilterable: true,
    isComparable: true,
    isCritical: false,
    rankWeight: 0.7,
    categoryKeys: ['plumbing'],
  },
  {
    key: 'wall_thickness_mm',
    label: 'Wall Thickness',
    dataType: 'number',
    group: 'dimensions',
    unit: 'mm',
    isFilterable: true,
    isComparable: true,
    isCritical: false,
    rankWeight: 0.55,
    categoryKeys: ['plumbing'],
  },
  {
    key: 'length_m',
    label: 'Length',
    dataType: 'number',
    group: 'dimensions',
    unit: 'm',
    isFilterable: false,
    isComparable: true,
    isCritical: false,
    rankWeight: 0.3,
    categoryKeys: ['plumbing'],
  },

  /* ---- Instrumentation ---- */
  {
    key: 'range_bar',
    label: 'Measuring Range',
    dataType: 'number',
    group: 'performance',
    unit: 'bar',
    isFilterable: true,
    isComparable: true,
    isCritical: true,
    rankWeight: 0.9,
    categoryKeys: ['instrumentation'],
  },
  {
    key: 'accuracy_class',
    label: 'Accuracy Class',
    dataType: 'text',
    group: 'performance',
    isFilterable: true,
    isComparable: true,
    isCritical: false,
    rankWeight: 0.6,
    categoryKeys: ['instrumentation'],
  },
  {
    key: 'dial_size_mm',
    label: 'Dial Size',
    dataType: 'number',
    group: 'dimensions',
    unit: 'mm',
    isFilterable: true,
    isComparable: true,
    isCritical: false,
    rankWeight: 0.4,
    categoryKeys: ['instrumentation'],
  },

  /* ---- Tools ---- */
  {
    key: 'drive_size',
    label: 'Drive Size',
    dataType: 'text',
    group: 'dimensions',
    isFilterable: true,
    isComparable: true,
    isCritical: false,
    rankWeight: 0.6,
    categoryKeys: ['tools'],
  },
  {
    key: 'torque_range_nm',
    label: 'Torque Range',
    dataType: 'number',
    group: 'performance',
    unit: 'Nm',
    isFilterable: true,
    isComparable: true,
    isCritical: false,
    rankWeight: 0.7,
    categoryKeys: ['tools'],
  },

  /* ---- Safety ---- */
  {
    key: 'en_standard',
    label: 'Standard',
    dataType: 'text',
    group: 'compliance',
    isFilterable: true,
    isComparable: true,
    isCritical: false,
    rankWeight: 0.6,
    categoryKeys: ['safety'],
  },
  {
    key: 'cut_level',
    label: 'Cut Resistance',
    dataType: 'text',
    group: 'performance',
    isFilterable: true,
    isComparable: true,
    isCritical: false,
    rankWeight: 0.7,
    categoryKeys: ['safety'],
  },
  {
    key: 'size_label',
    label: 'Size',
    dataType: 'text',
    group: 'dimensions',
    isFilterable: true,
    isComparable: true,
    isCritical: false,
    rankWeight: 0.5,
    categoryKeys: ['safety'],
  },
]

/* -------------------------------------------------------------------------- */
/* Lookups                                                                    */
/* -------------------------------------------------------------------------- */

export const SPEC_BY_KEY: ReadonlyMap<string, SpecDefinition> = new Map(
  SPEC_DEFINITIONS.map((definition) => [definition.key, definition])
)

export function getSpecDefinition(key: string): SpecDefinition | undefined {
  return SPEC_BY_KEY.get(key)
}

/** Specs applicable to a category — globals (empty categoryKeys) plus its own. */
export function specsForCategory(categoryKey: string): SpecDefinition[] {
  return SPEC_DEFINITIONS.filter(
    (definition) =>
      definition.categoryKeys.length === 0 || definition.categoryKeys.includes(categoryKey)
  )
}

/** Critical specs, used to decide the assistant's single follow-up question. */
export function criticalSpecsForCategory(categoryKey: string): SpecDefinition[] {
  return specsForCategory(categoryKey).filter((definition) => definition.isCritical)
}

export function specEnumLabel(key: string, value: string): string {
  const definition = SPEC_BY_KEY.get(key)
  const match = definition?.enumValues?.find((option) => option.value === value)
  return match?.label ?? value
}

/**
 * Flattened synonym index: lowercase term → { specKey, value }.
 *
 * Built once at module load. Longer phrases are matched before shorter ones by
 * the parser, so `ball valve` wins over `ball`.
 */
export interface SynonymHit {
  specKey: string
  value: string
  label: string
  /** Longer terms are more specific and score higher during parsing. */
  termLength: number
}

function buildSynonymIndex(): Map<string, SynonymHit[]> {
  const index = new Map<string, SynonymHit[]>()

  for (const definition of SPEC_DEFINITIONS) {
    if (!definition.enumValues) continue
    for (const option of definition.enumValues) {
      const terms = [option.label.toLowerCase(), ...option.synonyms.map((s) => s.toLowerCase())]
      for (const term of terms) {
        const hit: SynonymHit = {
          specKey: definition.key,
          value: option.value,
          label: option.label,
          termLength: term.length,
        }
        const existing = index.get(term)
        if (existing) existing.push(hit)
        else index.set(term, [hit])
      }
    }
  }

  return index
}

export const SYNONYM_INDEX: ReadonlyMap<string, SynonymHit[]> = buildSynonymIndex()

/** All synonym terms, longest first — the scan order used by the parser. */
export const SYNONYM_TERMS: readonly string[] = Array.from(SYNONYM_INDEX.keys()).sort(
  (a, b) => b.length - a.length
)

/* -------------------------------------------------------------------------- */
/* Applications & industries                                                  */
/* -------------------------------------------------------------------------- */

export const APPLICATIONS: ApplicationDefinition[] = [
  { key: 'hvac', label: 'HVAC', synonyms: ['hvac', 'air conditioning', 'ac', 'chilled water', 'heating', 'ventilation', 'cooling', 'chiller', 'ahu'] },
  { key: 'plumbing', label: 'Plumbing', synonyms: ['plumbing', 'water supply', 'potable water', 'sanitary', 'domestic water'] },
  { key: 'fire_fighting', label: 'Fire Fighting', synonyms: ['fire fighting', 'firefighting', 'fire', 'sprinkler system', 'hydrant', 'fire protection'] },
  { key: 'water_treatment', label: 'Water Treatment', synonyms: ['water treatment', 'stp', 'etp', 'wtp', 'sewage', 'effluent', 'ro plant'] },
  { key: 'compressed_air', label: 'Compressed Air', synonyms: ['compressed air', 'pneumatic', 'air line', 'air compressor'] },
  { key: 'steam', label: 'Steam', synonyms: ['steam', 'boiler', 'condensate'] },
  { key: 'chemical', label: 'Chemical Process', synonyms: ['chemical', 'corrosive', 'acid', 'solvent', 'process plant'] },
  { key: 'oil_gas', label: 'Oil & Gas', synonyms: ['oil and gas', 'oil & gas', 'petroleum', 'hydrocarbon', 'refinery'] },
  { key: 'food_beverage', label: 'Food & Beverage', synonyms: ['food', 'beverage', 'dairy', 'brewery', 'food grade', 'sanitary process'] },
  { key: 'pharmaceutical', label: 'Pharmaceutical', synonyms: ['pharma', 'pharmaceutical', 'clean room', 'wfi'] },
  { key: 'industrial_general', label: 'General Industrial', synonyms: ['industrial', 'general industrial', 'factory', 'plant', 'heavy duty'] },
  { key: 'building_services', label: 'Building Services', synonyms: ['building services', 'mep', 'commercial building', 'high rise', 'facility'] },
  { key: 'power', label: 'Power Generation', synonyms: ['power plant', 'power generation', 'turbine', 'genset'] },
  { key: 'irrigation', label: 'Irrigation', synonyms: ['irrigation', 'agriculture', 'farm', 'sprinkler irrigation'] },
  { key: 'marine', label: 'Marine', synonyms: ['marine', 'shipboard', 'offshore'] },
]

export const APPLICATION_BY_KEY: ReadonlyMap<string, ApplicationDefinition> = new Map(
  APPLICATIONS.map((application) => [application.key, application])
)

export function applicationLabel(key: string): string {
  return APPLICATION_BY_KEY.get(key)?.label ?? key
}

export const INDUSTRIES: ApplicationDefinition[] = [
  { key: 'commercial_building', label: 'Commercial Buildings', synonyms: ['office', 'commercial building', 'mall', 'retail'] },
  { key: 'residential', label: 'Residential', synonyms: ['residential', 'housing', 'apartment', 'villa'] },
  { key: 'hospitality', label: 'Hospitality', synonyms: ['hotel', 'hospitality', 'resort'] },
  { key: 'healthcare', label: 'Healthcare', synonyms: ['hospital', 'healthcare', 'clinic', 'medical'] },
  { key: 'manufacturing', label: 'Manufacturing', synonyms: ['factory', 'manufacturing', 'production line', 'workshop'] },
  { key: 'data_centre', label: 'Data Centres', synonyms: ['data centre', 'data center', 'server room', 'colocation'] },
  { key: 'warehouse', label: 'Warehousing', synonyms: ['warehouse', 'godown', 'logistics', 'distribution centre'] },
  { key: 'infrastructure', label: 'Infrastructure', synonyms: ['infrastructure', 'metro', 'airport', 'railway'] },
  { key: 'process_plant', label: 'Process Plants', synonyms: ['process plant', 'refinery', 'petrochemical'] },
]

export const INDUSTRY_BY_KEY: ReadonlyMap<string, ApplicationDefinition> = new Map(
  INDUSTRIES.map((industry) => [industry.key, industry])
)

export function industryLabel(key: string): string {
  return INDUSTRY_BY_KEY.get(key)?.label ?? key
}

/**
 * Label for a key that may belong to either taxonomy.
 *
 * Intent matching mixes `applications` and `industries` into one candidate
 * set, so any surface that renders those hits must resolve against both maps —
 * resolving industries through `applicationLabel` alone is how a buyer ends up
 * reading "commercial_building".
 */
export function applicationOrIndustryLabel(key: string): string {
  return APPLICATION_BY_KEY.get(key)?.label ?? INDUSTRY_BY_KEY.get(key)?.label ?? key
}
