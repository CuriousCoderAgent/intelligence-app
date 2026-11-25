import type { ReactNode, SVGProps } from 'react'

const Icon = ({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    width="22"
    height="22"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    {children}
  </svg>
)

export const BookmarkIcon = ({ filled }: { filled?: boolean }) => (
  <Icon fill={filled ? 'currentColor' : 'none'}>
    <path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4.2-6.5 4.2v-16a1 1 0 0 1 1-1Z" />
  </Icon>
)

export const ShareIcon = () => (
  <Icon>
    <path d="M12 15V3.5M7.5 8 12 3.5 16.5 8M5 12.5v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
  </Icon>
)

export const TopicsIcon = () => (
  <Icon>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </Icon>
)

export const LibraryIcon = () => (
  <Icon>
    <path d="M8.5 7.5h9a1 1 0 0 1 1 1v12l-5.5-3.4-5.5 3.4v-12a1 1 0 0 1 1-1Z" />
    <path d="M5.5 16V5a1.5 1.5 0 0 1 1.5-1.5h8" />
  </Icon>
)

export const CloseIcon = () => (
  <Icon>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
)

export const ChevronUpIcon = () => (
  <Icon>
    <path d="m6 14 6-6 6 6" />
  </Icon>
)
