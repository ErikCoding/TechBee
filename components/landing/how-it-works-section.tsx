import { Reveal } from '@/components/shared/reveal'
import { HowItWorksSteps } from '@/components/landing/how-it-works-steps'

/**
 * How a lesson comes together, told as a left-rail timeline rather than
 * a centred stack: markers + connecting line + arrows down the left,
 * each step's title and description at the matching height on the
 * right. The scroll-linked highlight lives in `HowItWorksSteps`.
 *
 * The section sits on the main dark background so the timeline reads as
 * a separate block after the product-flow surface above.
 */
export function HowItWorksSection() {
  return (
    <section
      className="relative isolate overflow-hidden border-b border-border bg-background"
      id="how-it-works"
      aria-labelledby="how-heading"
    >
      <div className="mx-auto max-w-4xl px-4 py-16 md:px-8 md:py-24">
        <Reveal className="max-w-2xl text-center sm:mx-auto">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Jak to działa</p>
          <h2
            id="how-heading"
            className="mt-3 text-balance text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl"
          >
            Trzy kroki do pierwszej lekcji
          </h2>
        </Reveal>

        <div className="mt-16">
          <HowItWorksSteps />
        </div>
      </div>
    </section>
  )
}
