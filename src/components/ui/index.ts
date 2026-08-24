/**
 * Design system barrel.
 *
 * Import primitives from `@/components/ui`, never from the individual files —
 * it keeps refactors of this folder invisible to the rest of the app.
 */

export { Button, ButtonLink, IconButton, buttonVariants } from './button'
export type { ButtonProps, ButtonLinkProps, IconButtonProps, ButtonVariant, ButtonSize } from './button'

export { Badge, Chip, SpecPill } from './badge'
export type { BadgeProps, ChipProps, Tone } from './badge'

export { Card, CardHeader, Divider, SectionHeading } from './card'
export type { CardProps } from './card'

export { Field, Input, Textarea, Select, Checkbox, Radio } from './input'
export type { FieldProps, InputProps, TextareaProps, SelectProps, CheckboxProps, RadioProps } from './input'

export {
  Skeleton,
  ProductCardSkeleton,
  ProductGridSkeleton,
  TextSkeleton,
  FilterSkeleton,
} from './skeleton'

export {
  StateBlock,
  NoResultsState,
  UnparseableQueryState,
  AiUnavailableState,
  NetworkErrorState,
  ServerErrorState,
  RateLimitedState,
  EmptySavedState,
  EmptyComparisonState,
  InlineError,
} from './states'
export type { StateProps, StateAction } from './states'

export {
  MatchRing,
  MatchBadge,
  MatchExplanationPanel,
  CriterionRow,
  ScoreBreakdown,
} from './match-score'
