import { motion } from 'framer-motion'
import { FEATURES } from '../data/features'
import {
  PresentDemo,
  CaptureDemo,
  OrganizeDemo,
  SearchDemo,
  CLIDemo,
  CrossPlatformDemo
} from './feature-demos'

const FEATURE_DEMOS: Record<string, React.ComponentType> = {
  Present: PresentDemo,
  Capture: CaptureDemo,
  Organize: OrganizeDemo,
  Search: SearchDemo,
  'AI agents': CLIDemo,
  Themes: CrossPlatformDemo
}

export default function FeaturesSection(): React.JSX.Element {
  return (
    <section className="relative px-8 py-24 lg:px-[30px]">
      <div className="mx-auto max-w-7xl">
        <div className="space-y-32">
          {FEATURES.map((feature, index) => {
            const isReversed = index % 2 === 1
            const DemoComponent = FEATURE_DEMOS[feature.tag]

            return (
              <motion.div
                key={feature.title}
                className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16"
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              >
                <div className={`space-y-6 ${isReversed ? 'lg:order-2' : 'lg:order-1'}`}>
                  <div className="space-y-4">
                    <span className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
                      {feature.tag}
                    </span>
                    <h3 className="text-2xl font-medium tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                      {feature.title}
                    </h3>
                  </div>
                  <p className="max-w-[500px] text-base leading-relaxed text-muted-foreground sm:text-lg">
                    {feature.description}
                  </p>
                </div>

                <div className={isReversed ? 'lg:order-1' : 'lg:order-2'}>
                  {DemoComponent && <DemoComponent />}
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
