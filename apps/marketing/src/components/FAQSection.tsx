import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { FAQItem } from '../data/faq'
import { FAQ_ITEMS } from '../data/faq'

function FAQAccordionItem({
  item,
  isOpen,
  onToggle
}: {
  item: FAQItem
  isOpen: boolean
  onToggle: () => void
}): React.JSX.Element {
  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={onToggle}
        className="group flex w-full items-center justify-between py-6 text-left outline-none transition-all"
      >
        <span className="pr-4 text-base font-medium text-foreground sm:text-lg">
          {item.question}
        </span>
        <Plus
          className={`size-5 shrink-0 text-muted-foreground transition-transform duration-200 ${
            isOpen ? 'rotate-45' : ''
          }`}
        />
      </button>
      <div
        className="grid transition-[grid-template-rows,opacity] duration-200 ease-in-out"
        style={{
          gridTemplateRows: isOpen ? '1fr' : '0fr',
          opacity: isOpen ? 1 : 0
        }}
      >
        <div className="overflow-hidden">
          <p className="pb-6 pr-12 text-base leading-relaxed text-muted-foreground">
            {item.answer}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function FAQSection(): React.JSX.Element {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const handleToggle = (index: number): void => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <section className="relative px-8 py-24 lg:px-[30px]">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 gap-12 xl:grid-cols-[1fr_1.5fr] xl:gap-20">
          <div className="xl:sticky xl:top-24 xl:self-start">
            <h2 className="text-3xl font-medium tracking-tight leading-[1.1] text-foreground sm:text-4xl xl:text-5xl">
              Frequently
              <br />
              asked questions
            </h2>
          </div>

          <div>
            <div className="w-full">
              {FAQ_ITEMS.map((item, index) => (
                <FAQAccordionItem
                  key={item.question}
                  item={item}
                  isOpen={openIndex === index}
                  onToggle={() => handleToggle(index)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
