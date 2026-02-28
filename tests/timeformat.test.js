import { describe, it, expect } from 'vitest'
import { formatTimeAgo } from '../package/contents/code/timeformat.js'

describe('formatTimeAgo', () => {
    const NOW = 1700000000000 // fixed reference point

    // ── Invalid / missing timestamps ─────────────────────────────────

    it('returns empty string for null', () => {
        expect(formatTimeAgo(null, NOW)).toBe('')
    })

    it('returns empty string for undefined', () => {
        expect(formatTimeAgo(undefined, NOW)).toBe('')
    })

    it('returns empty string for 0', () => {
        expect(formatTimeAgo(0, NOW)).toBe('')
    })

    it('returns empty string for negative timestamp', () => {
        expect(formatTimeAgo(-1, NOW)).toBe('')
    })

    // ── "just now" (< 60 seconds) ───────────────────────────────────

    it('returns "just now" for 0 seconds ago', () => {
        expect(formatTimeAgo(NOW, NOW)).toBe('just now')
    })

    it('returns "just now" for 30 seconds ago', () => {
        expect(formatTimeAgo(NOW - 30000, NOW)).toBe('just now')
    })

    it('returns "just now" for 59 seconds ago', () => {
        expect(formatTimeAgo(NOW - 59000, NOW)).toBe('just now')
    })

    // ── Minutes ──────────────────────────────────────────────────────

    it('returns "1 min ago" for exactly 60 seconds', () => {
        expect(formatTimeAgo(NOW - 60000, NOW)).toBe('1 min ago')
    })

    it('returns "5 mins ago" for 5 minutes', () => {
        expect(formatTimeAgo(NOW - 300000, NOW)).toBe('5 mins ago')
    })

    it('returns "59 mins ago" for 59 minutes', () => {
        expect(formatTimeAgo(NOW - 59 * 60000, NOW)).toBe('59 mins ago')
    })

    // ── Hours ────────────────────────────────────────────────────────

    it('returns "1 hour ago" for exactly 60 minutes', () => {
        expect(formatTimeAgo(NOW - 3600000, NOW)).toBe('1 hour ago')
    })

    it('returns "2 hours ago" for 2 hours', () => {
        expect(formatTimeAgo(NOW - 7200000, NOW)).toBe('2 hours ago')
    })

    it('returns "23 hours ago" for 23 hours', () => {
        expect(formatTimeAgo(NOW - 23 * 3600000, NOW)).toBe('23 hours ago')
    })

    // ── Days ─────────────────────────────────────────────────────────

    it('returns "1 day ago" for exactly 24 hours', () => {
        expect(formatTimeAgo(NOW - 86400000, NOW)).toBe('1 day ago')
    })

    it('returns "2 days ago" for 2 days', () => {
        expect(formatTimeAgo(NOW - 172800000, NOW)).toBe('2 days ago')
    })

    it('returns "30 days ago" for 30 days', () => {
        expect(formatTimeAgo(NOW - 30 * 86400000, NOW)).toBe('30 days ago')
    })

    // ── Boundary precision ───────────────────────────────────────────

    it('correctly transitions from seconds to minutes at the 60s boundary', () => {
        // 59.999 seconds → still "just now" (floor to 59)
        expect(formatTimeAgo(NOW - 59999, NOW)).toBe('just now')
        // 60.000 seconds → "1 min ago"
        expect(formatTimeAgo(NOW - 60000, NOW)).toBe('1 min ago')
    })

    it('correctly transitions from minutes to hours at the 60min boundary', () => {
        expect(formatTimeAgo(NOW - 59 * 60000, NOW)).toBe('59 mins ago')
        expect(formatTimeAgo(NOW - 60 * 60000, NOW)).toBe('1 hour ago')
    })

    it('correctly transitions from hours to days at the 24h boundary', () => {
        expect(formatTimeAgo(NOW - 23 * 3600000, NOW)).toBe('23 hours ago')
        expect(formatTimeAgo(NOW - 24 * 3600000, NOW)).toBe('1 day ago')
    })
})
