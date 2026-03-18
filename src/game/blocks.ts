export enum BlockId {
  Air = 0,
  Grass = 1,
  Dirt = 2,
  Stone = 3,
  Wood = 12,
  Leaves = 13,
  Sand = 14,
  Water = 15,
  Red = 4,
  Orange = 5,
  Yellow = 6,
  Green = 7,
  Cyan = 8,
  Blue = 9,
  Purple = 10,
  Pink = 11,
}

export type BlockDef = {
  id: BlockId
  name: string
  cssColor: string
  color: number
  collidable: boolean
  occludes: boolean
  transparent: boolean
}

export const BLOCKS: Record<BlockId, BlockDef> = {
  [BlockId.Air]: {
    id: BlockId.Air,
    name: 'Air',
    cssColor: 'transparent',
    color: 0x000000,
    collidable: false,
    occludes: false,
    transparent: true,
  },
  [BlockId.Grass]: {
    id: BlockId.Grass,
    name: 'Grass',
    cssColor: '#4ade80',
    color: 0x4ade80,
    collidable: true,
    occludes: true,
    transparent: false,
  },
  [BlockId.Dirt]: {
    id: BlockId.Dirt,
    name: 'Dirt',
    cssColor: '#8b5a2b',
    color: 0x8b5a2b,
    collidable: true,
    occludes: true,
    transparent: false,
  },
  [BlockId.Stone]: {
    id: BlockId.Stone,
    name: 'Stone',
    cssColor: '#94a3b8',
    color: 0x94a3b8,
    collidable: true,
    occludes: true,
    transparent: false,
  },
  [BlockId.Wood]: {
    id: BlockId.Wood,
    name: 'Wood',
    cssColor: '#b45309',
    color: 0xb45309,
    collidable: true,
    occludes: true,
    transparent: false,
  },
  [BlockId.Leaves]: {
    id: BlockId.Leaves,
    name: 'Leaves',
    cssColor: '#16a34a',
    color: 0x16a34a,
    collidable: true,
    occludes: true,
    transparent: false,
  },
  [BlockId.Sand]: {
    id: BlockId.Sand,
    name: 'Sand',
    cssColor: '#facc15',
    color: 0xfacc15,
    collidable: true,
    occludes: true,
    transparent: false,
  },
  [BlockId.Water]: {
    id: BlockId.Water,
    name: 'Water',
    cssColor: 'rgba(59,130,246,0.7)',
    color: 0x3b82f6,
    collidable: false,
    occludes: false,
    transparent: true,
  },
  [BlockId.Red]: {
    id: BlockId.Red,
    name: 'Red',
    cssColor: '#ef4444',
    color: 0xef4444,
    collidable: true,
    occludes: true,
    transparent: false,
  },
  [BlockId.Orange]: {
    id: BlockId.Orange,
    name: 'Orange',
    cssColor: '#f97316',
    color: 0xf97316,
    collidable: true,
    occludes: true,
    transparent: false,
  },
  [BlockId.Yellow]: {
    id: BlockId.Yellow,
    name: 'Yellow',
    cssColor: '#eab308',
    color: 0xeab308,
    collidable: true,
    occludes: true,
    transparent: false,
  },
  [BlockId.Green]: {
    id: BlockId.Green,
    name: 'Green',
    cssColor: '#22c55e',
    color: 0x22c55e,
    collidable: true,
    occludes: true,
    transparent: false,
  },
  [BlockId.Cyan]: {
    id: BlockId.Cyan,
    name: 'Cyan',
    cssColor: '#06b6d4',
    color: 0x06b6d4,
    collidable: true,
    occludes: true,
    transparent: false,
  },
  [BlockId.Blue]: {
    id: BlockId.Blue,
    name: 'Blue',
    cssColor: '#3b82f6',
    color: 0x3b82f6,
    collidable: true,
    occludes: true,
    transparent: false,
  },
  [BlockId.Purple]: {
    id: BlockId.Purple,
    name: 'Purple',
    cssColor: '#a855f7',
    color: 0xa855f7,
    collidable: true,
    occludes: true,
    transparent: false,
  },
  [BlockId.Pink]: {
    id: BlockId.Pink,
    name: 'Pink',
    cssColor: '#ec4899',
    color: 0xec4899,
    collidable: true,
    occludes: true,
    transparent: false,
  },
}

export function isSolidBlock(id: BlockId): boolean {
  return BLOCKS[id]?.collidable ?? false
}

export const DEFAULT_HOTBAR: BlockId[] = [
  BlockId.Red,
  BlockId.Orange,
  BlockId.Yellow,
  BlockId.Green,
  BlockId.Cyan,
  BlockId.Blue,
  BlockId.Purple,
  BlockId.Pink,
  BlockId.Stone,
]

