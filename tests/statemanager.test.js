import { describe, it, expect } from 'vitest'
import {
    isFavorite,
    toggleFavorite,
    isGroupCollapsed,
    toggleGroup,
    recordConnection
} from '../package/contents/code/statemanager.js'

describe('isFavorite', () => {
    it('returns true when host is in favorites', () => {
        expect(isFavorite(['a', 'b', 'c'], 'b')).toBe(true)
    })

    it('returns false when host is not in favorites', () => {
        expect(isFavorite(['a', 'b'], 'c')).toBe(false)
    })

    it('returns false for empty favorites', () => {
        expect(isFavorite([], 'a')).toBe(false)
    })
})

describe('toggleFavorite', () => {
    it('adds a host to favorites when absent', () => {
        expect(toggleFavorite(['a'], 'b')).toEqual(['a', 'b'])
    })

    it('removes a host from favorites when present', () => {
        expect(toggleFavorite(['a', 'b', 'c'], 'b')).toEqual(['a', 'c'])
    })

    it('does not mutate the original array', () => {
        const original = ['a', 'b']
        toggleFavorite(original, 'c')
        expect(original).toEqual(['a', 'b'])
    })

    it('handles toggling on empty array', () => {
        expect(toggleFavorite([], 'a')).toEqual(['a'])
    })

    it('is idempotent — adding then removing yields original', () => {
        const original = ['x', 'y']
        const added = toggleFavorite(original, 'z')
        const removed = toggleFavorite(added, 'z')
        expect(removed).toEqual(['x', 'y'])
    })

    it('handles toggling the only favorite off', () => {
        expect(toggleFavorite(['solo'], 'solo')).toEqual([])
    })
})

describe('isGroupCollapsed', () => {
    it('returns true when group is collapsed', () => {
        expect(isGroupCollapsed(['Production', 'Staging'], 'Production')).toBe(true)
    })

    it('returns false when group is not collapsed', () => {
        expect(isGroupCollapsed(['Production'], 'Staging')).toBe(false)
    })

    it('returns false for empty collapsed list', () => {
        expect(isGroupCollapsed([], 'Production')).toBe(false)
    })
})

describe('toggleGroup', () => {
    it('collapses a group when expanded', () => {
        expect(toggleGroup([], 'Production')).toEqual(['Production'])
    })

    it('expands a group when collapsed', () => {
        expect(toggleGroup(['Production', 'Staging'], 'Production')).toEqual(['Staging'])
    })

    it('does not mutate the original array', () => {
        const original = ['Production']
        toggleGroup(original, 'Staging')
        expect(original).toEqual(['Production'])
    })

    it('is idempotent — collapsing then expanding yields original', () => {
        const original = []
        const collapsed = toggleGroup(original, 'Group')
        const expanded = toggleGroup(collapsed, 'Group')
        expect(expanded).toEqual([])
    })
})

describe('recordConnection', () => {
    it('records a new connection timestamp', () => {
        const history = {}
        const result = recordConnection(history, 'myhost', 1700000000000)
        expect(result).toEqual({ myhost: 1700000000000 })
    })

    it('overwrites previous timestamp for same host', () => {
        const history = { myhost: 1600000000000 }
        const result = recordConnection(history, 'myhost', 1700000000000)
        expect(result.myhost).toBe(1700000000000)
    })

    it('preserves other entries', () => {
        const history = { other: 1600000000000 }
        const result = recordConnection(history, 'myhost', 1700000000000)
        expect(result.other).toBe(1600000000000)
        expect(result.myhost).toBe(1700000000000)
    })

    it('does not mutate the original object', () => {
        const original = { existing: 100 }
        recordConnection(original, 'new', 200)
        expect(original).toEqual({ existing: 100 })
    })

    it('uses Date.now() when no timestamp provided', () => {
        const before = Date.now()
        const result = recordConnection({}, 'host')
        const after = Date.now()
        expect(result.host).toBeGreaterThanOrEqual(before)
        expect(result.host).toBeLessThanOrEqual(after)
    })
})
