import React, { useEffect, useState } from 'react'

const BUY_ME_A_COFFEE_URL = 'https://buymeacoffee.com/szabadkai'
const BUY_ME_A_COFFEE_IMAGE = 'https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png'
const STORAGE_KEY = 'buy-coffee-collapsed'

export function BuyCoffeeButton() {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored === '1') {
        setCollapsed(true)
      }
    } catch {
      // ignore storage access issues
    }
  }, [])

  useEffect(() => {
    try {
      if (collapsed) {
        window.localStorage.setItem(STORAGE_KEY, '1')
      } else {
        window.localStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      // ignore storage access issues
    }
  }, [collapsed])

  if (collapsed) {
    return (
      <div className="buy-coffee collapsed">
        <button
          type="button"
          className="buy-coffee-icon"
          aria-label="Show Buy Me a Coffee support button"
          onClick={() => setCollapsed(false)}
        >
          <span aria-hidden="true">☕</span>
        </button>
      </div>
    )
  }

  return (
    <div className="buy-coffee">
      <a
        className="buy-coffee-link"
        href={BUY_ME_A_COFFEE_URL}
        target="_blank"
        rel="noreferrer noopener"
        aria-label="Support WebSynth Studio via Buy Me a Coffee"
      >
        <span className="sr-only">Support WebSynth Studio on Buy Me a Coffee</span>
        <img
          src={BUY_ME_A_COFFEE_IMAGE}
          alt=""
          loading="lazy"
          width={220}
          height={62}
        />
      </a>
      <button
        type="button"
        className="buy-coffee-dismiss"
        aria-label="Hide Buy Me a Coffee support button"
        onClick={() => setCollapsed(true)}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  )
}
