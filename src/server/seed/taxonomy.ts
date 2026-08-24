import type { Brand, Category, Seller } from '@/lib/domain/catalog'

/**
 * Catalogue taxonomy.
 *
 * Brands and sellers here are fictional. They are written to read like real
 * Indian and European industrial suppliers because a catalogue populated with
 * "Brand A / Brand B" fails the only test that matters — whether a procurement
 * manager would believe it. No real trademark is used.
 *
 * `productCount` is denormalised; `recomputeCounts()` in the memory repository
 * refreshes it after seeding so the numbers are always truthful.
 */

/* -------------------------------------------------------------------------- */
/* Categories                                                                 */
/* -------------------------------------------------------------------------- */

interface CategorySeed {
  key: string
  name: string
  description: string
  icon: string
  featured: boolean
  children: { key: string; name: string; description: string }[]
}

const CATEGORY_SEEDS: CategorySeed[] = [
  {
    key: 'valves',
    name: 'Valves & Flow Control',
    description:
      'Isolation, regulation and non-return valves in stainless steel, cast iron, brass and bronze — from DN15 utility service through DN300 chilled water mains.',
    icon: 'Waves',
    featured: true,
    children: [
      { key: 'ball-valves', name: 'Ball Valves', description: 'Two-piece and three-piece isolation valves, lever and gear operated.' },
      { key: 'butterfly-valves', name: 'Butterfly Valves', description: 'Wafer and lugged pattern for large-bore isolation.' },
      { key: 'check-valves', name: 'Check Valves', description: 'Dual-plate, swing and spring-loaded non-return valves.' },
      { key: 'control-valves', name: 'Control & Balancing', description: 'Motorised, pressure-reducing and double-regulating valves.' },
      { key: 'strainers', name: 'Strainers', description: 'Y-type and pot strainers for pump and coil protection.' },
    ],
  },
  {
    key: 'hvac',
    name: 'HVAC',
    description:
      'Air handling, fan coil, ducting and terminal equipment for commercial and industrial climate systems.',
    icon: 'Wind',
    featured: true,
    children: [
      { key: 'air-handling', name: 'Air Handling Units', description: 'Modular and packaged AHUs with coil and filter sections.' },
      { key: 'fan-coil-units', name: 'Fan Coil Units', description: 'Ceiling concealed and exposed FCUs.' },
      { key: 'ventilation-fans', name: 'Fans & Ventilation', description: 'Inline, axial and centrifugal fans.' },
      { key: 'filters-coils', name: 'Filters & Coils', description: 'Pre-filters, fine filters, HEPA and heat exchange coils.' },
    ],
  },
  {
    key: 'pumps',
    name: 'Pumps',
    description:
      'Centrifugal, submersible, booster and dosing pumps for water, chilled water, fire and process duty.',
    icon: 'Gauge',
    featured: true,
    children: [
      { key: 'centrifugal-pumps', name: 'Centrifugal Pumps', description: 'End-suction and split-case pumps.' },
      { key: 'submersible-pumps', name: 'Submersible Pumps', description: 'Borewell, dewatering and sewage pumps.' },
      { key: 'booster-sets', name: 'Booster Sets', description: 'Pressure boosting systems with variable speed control.' },
      { key: 'dosing-pumps', name: 'Dosing Pumps', description: 'Metering pumps for chemical treatment.' },
    ],
  },
  {
    key: 'electrical',
    name: 'Electrical',
    description:
      'Protection, switching and distribution equipment — MCBs, MCCBs, contactors, panels and cable management.',
    icon: 'Zap',
    featured: true,
    children: [
      { key: 'circuit-breakers', name: 'Circuit Breakers', description: 'MCB, MCCB, RCCB and ACB protection devices.' },
      { key: 'switchgear', name: 'Switchgear & Contactors', description: 'Contactors, overload relays and starters.' },
      { key: 'distribution', name: 'Distribution Boards', description: 'Enclosures, busbars and distribution panels.' },
      { key: 'cable-management', name: 'Cable Management', description: 'Trays, ladders, glands and conduits.' },
    ],
  },
  {
    key: 'fire-fighting',
    name: 'Fire Fighting',
    description:
      'Sprinklers, hydrants, hose reels and detection equipment conforming to IS, UL and FM standards.',
    icon: 'Flame',
    featured: true,
    children: [
      { key: 'sprinklers', name: 'Sprinklers', description: 'Pendent, upright and sidewall sprinkler heads.' },
      { key: 'hydrants', name: 'Hydrants & Landing Valves', description: 'Single and double headed hydrant valves.' },
      { key: 'hose-reels', name: 'Hoses & Reels', description: 'RRL hoses, first-aid hose reels and couplings.' },
      { key: 'detection', name: 'Detection & Alarm', description: 'Smoke, heat and flow detection devices.' },
    ],
  },
  {
    key: 'plumbing',
    name: 'Plumbing & Piping',
    description:
      'Pipes, fittings, insulation and support systems in copper, CPVC, uPVC, GI and stainless steel.',
    icon: 'Droplets',
    featured: true,
    children: [
      { key: 'pipes', name: 'Pipes', description: 'Copper, CPVC, uPVC, GI and SS pipe in standard lengths.' },
      { key: 'fittings', name: 'Fittings', description: 'Elbows, tees, reducers, unions and flanges.' },
      { key: 'insulation', name: 'Insulation', description: 'Nitrile rubber, PUF and glass wool pipe insulation.' },
      { key: 'supports', name: 'Supports & Hangers', description: 'Clamps, rods, brackets and anti-vibration mounts.' },
    ],
  },
  {
    key: 'instrumentation',
    name: 'Instrumentation',
    description:
      'Pressure, temperature, flow and level measurement instruments for plant and building services.',
    icon: 'CircleGauge',
    featured: true,
    children: [
      { key: 'pressure-gauges', name: 'Pressure Gauges', description: 'Bourdon tube, diaphragm and digital gauges.' },
      { key: 'thermometers', name: 'Temperature', description: 'Bimetal thermometers, thermowells and RTDs.' },
      { key: 'flow-meters', name: 'Flow Meters', description: 'Electromagnetic, ultrasonic and mechanical meters.' },
      { key: 'transmitters', name: 'Transmitters', description: 'Pressure and level transmitters with 4–20 mA output.' },
    ],
  },
  {
    key: 'industrial',
    name: 'Industrial Equipment',
    description:
      'Compressors, gear motors, drives and material handling equipment for plant operations.',
    icon: 'Factory',
    featured: false,
    children: [
      { key: 'compressors', name: 'Air Compressors', description: 'Screw and reciprocating compressors with receivers.' },
      { key: 'motors-drives', name: 'Motors & Drives', description: 'Induction motors, gearboxes and variable frequency drives.' },
      { key: 'material-handling', name: 'Material Handling', description: 'Hoists, trolleys and lifting tackle.' },
    ],
  },
  {
    key: 'tools',
    name: 'Tools',
    description:
      'Hand tools, power tools and calibrated instruments for installation and maintenance teams.',
    icon: 'Wrench',
    featured: false,
    children: [
      { key: 'hand-tools', name: 'Hand Tools', description: 'Wrenches, spanners, pliers and pipe tools.' },
      { key: 'power-tools', name: 'Power Tools', description: 'Drills, grinders and threading machines.' },
      { key: 'measuring-tools', name: 'Measuring & Calibration', description: 'Torque wrenches, clamp meters and gauges.' },
    ],
  },
  {
    key: 'safety',
    name: 'Safety Equipment',
    description:
      'Personal protective equipment and site safety products certified to EN and IS standards.',
    icon: 'HardHat',
    featured: false,
    children: [
      { key: 'hand-protection', name: 'Hand Protection', description: 'Cut-resistant, chemical and general handling gloves.' },
      { key: 'head-eye', name: 'Head & Eye Protection', description: 'Helmets, goggles, face shields and visors.' },
      { key: 'height-safety', name: 'Height Safety', description: 'Harnesses, lanyards and anchor devices.' },
      { key: 'respiratory', name: 'Respiratory', description: 'Disposable and reusable respirators with filters.' },
    ],
  },
]

function buildCategories(): Category[] {
  const categories: Category[] = []
  let order = 0

  for (const seed of CATEGORY_SEEDS) {
    const parentId = `cat_${seed.key}`
    categories.push({
      id: parentId,
      key: seed.key,
      slug: seed.key,
      name: seed.name,
      parentId: null,
      description: seed.description,
      icon: seed.icon,
      productCount: 0,
      featured: seed.featured,
      sortOrder: order++,
    })

    let childOrder = 0
    for (const child of seed.children) {
      categories.push({
        id: `cat_${child.key}`,
        key: child.key,
        slug: child.key,
        name: child.name,
        parentId,
        description: child.description,
        icon: seed.icon,
        productCount: 0,
        featured: false,
        sortOrder: childOrder++,
      })
    }
  }

  return categories
}

export const CATEGORIES: Category[] = buildCategories()

/* -------------------------------------------------------------------------- */
/* Brands                                                                     */
/* -------------------------------------------------------------------------- */

interface BrandSeed {
  key: string
  name: string
  country: string
  description: string
}

const BRAND_SEEDS: BrandSeed[] = [
  {
    key: 'vantek',
    name: 'Vantek Valves',
    country: 'India',
    description:
      'Coimbatore-based valve manufacturer supplying stainless and bronze isolation valves to building services and process industries since 1994.',
  },
  {
    key: 'dorsett',
    name: 'Dorsett Flow Control',
    country: 'United Kingdom',
    description:
      'British engineered valves and commissioning equipment. Specified widely on data centre and pharmaceutical chilled water systems.',
  },
  {
    key: 'aeroflux',
    name: 'Aeroflux Climate Systems',
    country: 'India',
    description:
      'Pune manufacturer of air handling units, fan coil units and ventilation equipment for commercial HVAC projects.',
  },
  {
    key: 'hydromek',
    name: 'Hydromek Pumps',
    country: 'India',
    description:
      'Rajkot pump manufacturer covering centrifugal, submersible and booster applications across water and fire duty.',
  },
  {
    key: 'sanchay',
    name: 'Sanchay Electricals',
    country: 'India',
    description:
      'Low-voltage protection and distribution equipment manufactured in Noida to IS/IEC standards.',
  },
  {
    key: 'pyrocore',
    name: 'Pyrocore Fire Systems',
    country: 'India',
    description:
      'Chennai-based fire protection manufacturer with UL-listed sprinklers and IS-marked hydrant equipment.',
  },
  {
    key: 'copperline',
    name: 'Copperline Piping',
    country: 'India',
    description:
      'Ahmedabad producer of copper tube, CPVC systems and pipe support hardware for plumbing and medical gas.',
  },
  {
    key: 'trumeta',
    name: 'Trumeta Instruments',
    country: 'India',
    description:
      'Bengaluru instrumentation manufacturer producing pressure, temperature and flow measurement devices.',
  },
  {
    key: 'altmeyer',
    name: 'Altmeyer Prozesstechnik',
    country: 'Germany',
    description:
      'German process instrumentation with high-accuracy transmitters and gauges for pharmaceutical and chemical plants.',
  },
  {
    key: 'gripwell',
    name: 'Gripwell Tools',
    country: 'India',
    description:
      'Ludhiana tool manufacturer producing hand tools, pipe tools and calibrated torque equipment.',
  },
  {
    key: 'nirvaan',
    name: 'Nirvaan Safety',
    country: 'India',
    description:
      'Kanpur PPE manufacturer with EN-certified hand, head and height protection for industrial sites.',
  },
  {
    key: 'steelgrid',
    name: 'Steelgrid Industrial',
    country: 'India',
    description:
      'Jamshedpur supplier of compressors, gear motors and material handling equipment for plant maintenance.',
  },
]

export const BRANDS: Brand[] = BRAND_SEEDS.map((seed) => ({
  id: `brand_${seed.key}`,
  key: seed.key,
  slug: seed.key,
  name: seed.name,
  country: seed.country,
  description: seed.description,
  productCount: 0,
}))

/* -------------------------------------------------------------------------- */
/* Sellers                                                                    */
/* -------------------------------------------------------------------------- */

interface SellerSeed {
  key: string
  name: string
  city: string
  state: string
  gstin: string
  verified: boolean
  fulfilmentRate: number
  responseHours: number
  since: number
}

const SELLER_SEEDS: SellerSeed[] = [
  {
    key: 'metro-industrial',
    name: 'Metro Industrial Supply Co.',
    city: 'Mumbai',
    state: 'Maharashtra',
    gstin: '27AABCM4471K1Z8',
    verified: true,
    fulfilmentRate: 0.97,
    responseHours: 3,
    since: 2011,
  },
  {
    key: 'deccan-mep',
    name: 'Deccan MEP Traders',
    city: 'Hyderabad',
    state: 'Telangana',
    gstin: '36AAFCD8812M1ZR',
    verified: true,
    fulfilmentRate: 0.94,
    responseHours: 5,
    since: 2015,
  },
  {
    key: 'northline',
    name: 'Northline Engineering Supplies',
    city: 'New Delhi',
    state: 'Delhi',
    gstin: '07AAGCN2290H1ZK',
    verified: true,
    fulfilmentRate: 0.91,
    responseHours: 7,
    since: 2009,
  },
  {
    key: 'coastal-flow',
    name: 'Coastal Flow Solutions',
    city: 'Chennai',
    state: 'Tamil Nadu',
    gstin: '33AAHCC5563Q1ZV',
    verified: true,
    fulfilmentRate: 0.96,
    responseHours: 4,
    since: 2017,
  },
  {
    key: 'westward-supply',
    name: 'Westward Supply Partners',
    city: 'Ahmedabad',
    state: 'Gujarat',
    gstin: '24AACCW9014L1ZD',
    verified: false,
    fulfilmentRate: 0.88,
    responseHours: 11,
    since: 2020,
  },
]

export const SELLERS: Seller[] = SELLER_SEEDS.map((seed) => ({
  id: `seller_${seed.key}`,
  key: seed.key,
  name: seed.name,
  city: seed.city,
  state: seed.state,
  gstin: seed.gstin,
  verified: seed.verified,
  fulfilmentRate: seed.fulfilmentRate,
  responseHours: seed.responseHours,
  since: seed.since,
}))

/* -------------------------------------------------------------------------- */
/* Lookups                                                                    */
/* -------------------------------------------------------------------------- */

export const CATEGORY_BY_KEY = new Map(CATEGORIES.map((c) => [c.key, c]))
export const CATEGORY_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]))
export const BRAND_BY_KEY = new Map(BRANDS.map((b) => [b.key, b]))
export const BRAND_BY_ID = new Map(BRANDS.map((b) => [b.id, b]))
export const SELLER_BY_KEY = new Map(SELLERS.map((s) => [s.key, s]))
export const SELLER_BY_ID = new Map(SELLERS.map((s) => [s.id, s]))

export const TOP_LEVEL_CATEGORIES = CATEGORIES.filter((c) => c.parentId === null)

export function childCategories(parentKey: string): Category[] {
  const parent = CATEGORY_BY_KEY.get(parentKey)
  if (!parent) return []
  return CATEGORIES.filter((c) => c.parentId === parent.id)
}

/** Resolves a category key to itself plus all descendants — used by filters. */
export function categoryKeyWithDescendants(key: string): string[] {
  const parent = CATEGORY_BY_KEY.get(key)
  if (!parent) return [key]
  const children = CATEGORIES.filter((c) => c.parentId === parent.id).map((c) => c.key)
  return [key, ...children]
}
