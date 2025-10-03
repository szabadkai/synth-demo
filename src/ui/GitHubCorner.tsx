import React from 'react'

interface GitHubCornerProps {
  href?: string
}

export function GitHubCorner({ href = 'https://github.com/szabadkai/synth-demo' }: GitHubCornerProps) {
  return (
    <a
      className="github-corner"
      href={href}
      aria-label="View WebSynth Studio on GitHub"
      target="_blank"
      rel="noreferrer noopener"
    >
      <span className="sr-only">View the project repository on GitHub</span>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 0a12 12 0 0 0-3.79 23.4c.6.11.82-.26.82-.58 0-.29-.01-1.05-.02-2.05-3.34.73-4.04-1.61-4.04-1.61-.55-1.4-1.35-1.78-1.35-1.78-1.11-.76.08-.75.08-.75 1.22.09 1.87 1.26 1.87 1.26 1.09 1.86 2.86 1.32 3.56 1 .11-.79.43-1.32.78-1.62-2.66-.3-5.47-1.33-5.47-5.9 0-1.3.47-2.37 1.24-3.21-.12-.3-.54-1.51.12-3.15 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.3-1.55 3.3-1.23 3.3-1.23.66 1.64.24 2.85.12 3.15.77.84 1.24 1.9 1.24 3.21 0 4.58-2.82 5.6-5.5 5.9.44.39.83 1.16.83 2.34 0 1.69-.02 3.05-.02 3.47 0 .32.22.69.83.57A12 12 0 0 0 12 0Z" />
      </svg>
    </a>
  )
}
