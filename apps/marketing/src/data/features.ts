export interface Feature {
  tag: string
  title: string
  description: string
  colors: [string, string]
  media?: string
}

export const FEATURES: Feature[] = [
  {
    tag: 'Present',
    title: 'Your invisible teleprompter',
    description:
      'Keep talking points on screen during demos, streams, and recordings. ONPOINT hides from screen capture so your audience only sees your content, not your notes.',
    colors: ['#f43f5e', '#f59e0b']
  },
  {
    tag: 'Capture',
    title: 'Write notes at the speed of thought',
    description:
      'A distraction-free editor that gets out of your way. Markdown-native with keyboard shortcuts you already know. Just open and start typing.',
    colors: ['#06b6d4', '#3b82f6'],
    media: '/markdown.mov'
  },
  {
    tag: 'Organize',
    title: 'Structure that adapts to you',
    description:
      'Folders and nesting that stay out of your way until you need them. Your notes, your hierarchy.',
    colors: ['#8b5cf6', '#ec4899']
  },
  {
    tag: 'Search',
    title: 'Find anything instantly',
    description:
      'Full-text search across all your notes in milliseconds. Fuzzy title matching and content search that just works.',
    colors: ['#f59e0b', '#ef4444']
  },
  {
    tag: 'AI agents',
    title: 'A CLI built for AI agents',
    description:
      'Read, create, and search notes from the terminal. Strip markdown, extract sections, or output JSON: purpose-built flags for context engineering that let agents pull exactly what they need without polluting their context window.',
    colors: ['#a855f7', '#6366f1']
  },
  {
    tag: 'Themes',
    title: 'Make it yours',
    description:
      '12 themes across light and dark modes. Switch instantly to match your workflow, your mood, or your monitor.',
    colors: ['#10b981', '#06b6d4']
  }
]
