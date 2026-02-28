export interface FAQItem {
  question: string
  answer: string
}

export const FAQ_ITEMS: FAQItem[] = [
  {
    question: 'Is ONPOINT free?',
    answer:
      'Yes, ONPOINT is completely free and open source. Download it today for macOS, Windows, or Linux.'
  },
  {
    question: 'Does ONPOINT support Markdown?',
    answer:
      'Absolutely. ONPOINT is Markdown-native with full support for frontmatter, code blocks, links, and all standard Markdown syntax.'
  },
  {
    question: 'Where are my notes stored?',
    answer:
      'Your notes are stored locally on your machine as plain Markdown files. You own your data, always.'
  },
  {
    question: 'Can I use ONPOINT from the terminal?',
    answer:
      'Yes. ONPOINT ships with a powerful CLI that lets you create, search, and manage notes directly from your terminal.'
  },
  {
    question: 'What platforms are supported?',
    answer:
      'ONPOINT is available on macOS (Intel & Apple Silicon), Windows, and Linux (AppImage, Snap, and .deb).'
  },
  {
    question: 'How is ONPOINT different from Obsidian or Notion?',
    answer:
      'ONPOINT is built for anyone who values speed and simplicity: engineers, creators, students, or anyone who just wants a fast, distraction-free place to write. Features like Ghost Mode (hides the window from screen capture for use as a teleprompter during recordings and demos) and a CLI designed for AI context engineering set it apart. Open source, fully offline, and free.'
  }
]
