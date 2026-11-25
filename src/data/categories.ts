import type { Category, CategoryId } from '../types.ts'

export const CATEGORIES: Category[] = [
  { id: 'self', name: 'Self-Development', ground: '#3d1c0a', accent: '#ffa35c', palette: 'burnt orange, ember and deep brown' },
  { id: 'geo', name: 'Geography', ground: '#07302f', accent: '#62e0d6', palette: 'deep teal, sea green and sand' },
  { id: 'sci', name: 'Science', ground: '#06293f', accent: '#72ccff', palette: 'deep ocean blue and bright cyan' },
  { id: 'space', name: 'Space', ground: '#0e0f33', accent: '#ffd98a', palette: 'midnight indigo with pale gold starlight' },
  { id: 'pol', name: 'Politics', ground: '#3d0f1a', accent: '#ff8f9f', palette: 'deep crimson, oxblood and rose' },
  { id: 'tech', name: 'Technology', ground: '#22124a', accent: '#bda4ff', palette: 'deep violet and electric lavender' },
  { id: 'gk', name: 'General Knowledge', ground: '#2e2a08', accent: '#f4d84a', palette: 'dark olive and mustard yellow' },
  { id: 'hist', name: 'History', ground: '#33230e', accent: '#e9c07f', palette: 'sepia, umber and antique gold' },
  { id: 'soc', name: 'Sociology', ground: '#35103a', accent: '#ee8cf2', palette: 'deep plum and magenta' },
  { id: 'math', name: 'Maths', ground: '#1b300c', accent: '#b9ea6b', palette: 'dark moss green and lime' },
  { id: 'eng', name: 'Engineering', ground: '#0d2452', accent: '#a9c6ff', palette: 'blueprint blue and pale steel' },
  { id: 'econ', name: 'Economics', ground: '#0b3021', accent: '#5fe3a0', palette: 'dark emerald and mint green' },
]

export const CATEGORY_BY_ID = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
) as Record<CategoryId, Category>
