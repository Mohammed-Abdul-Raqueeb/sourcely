/**
 * Starter prompts.
 *
 * Written as a procurement engineer would actually phrase them — with the
 * duty, the system, and a budget, and in two cases without naming the product
 * at all. Generic prompts ("find me a valve") teach the buyer that the
 * assistant is a search box; these teach them it is not.
 */

export interface StarterPrompt {
  category: string
  label: string
  query: string
}

export const STARTER_PROMPTS: StarterPrompt[] = [
  {
    category: 'Valves',
    label: 'Stainless threaded valve for an HVAC riser, under ₹5,000',
    query:
      'I need a stainless steel threaded valve for a chilled water riser in a commercial building, under ₹5,000',
  },
  {
    category: 'No part name',
    label: 'Something to control water flow in a commercial HVAC system',
    query:
      'I need something to control water flow in a commercial HVAC system. It should be stainless steel and work with a threaded connection.',
  },
  {
    category: 'Electrical',
    label: '100 A three-pole MCCB with 25 kA breaking capacity',
    query: '100A 3 pole MCCB with 25kA breaking capacity for a commercial building distribution board',
  },
  {
    category: 'Pumps',
    label: 'End-suction pump, 30 m³/h at 30 m head',
    query: 'End suction centrifugal pump for chilled water, around 30 m3/h at 30 m head, three phase',
  },
  {
    category: 'HVAC',
    label: 'Air handling for a large warehouse',
    query: 'Find HVAC equipment suitable for a large warehouse — high airflow, and it has to run continuously',
  },
  {
    category: 'Instrumentation',
    label: 'Pressure gauge for chilled water, 0–16 bar',
    query: 'Pressure gauge for chilled water, 0-16 bar, 100mm dial, stainless',
  },
  {
    category: 'Fire fighting',
    label: 'Pendent sprinklers for an office fit-out',
    query: 'Pendent sprinklers for an office fit-out, 68 degree bulb, UL listed, I need about 200 of them',
  },
  {
    category: 'Safety',
    label: 'Cut-resistant gloves for sheet metal handling',
    query: 'Cut resistant gloves for sheet metal handling, EN388 level C or better, size L, under ₹500 a pair',
  },
]
