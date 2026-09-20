/**
 * GamblePause Centralized Brand Theme Configuration
 * Official Brand Colors:
 * - Primary: GamblePause Red (#DC2626 / #B91C1C)
 * - Secondary: White (#FFFFFF)
 * - Neutral Dark: #111827 / #1F2937
 * - Neutral Grey: #F3F4F6 / #E5E7EB / #9CA3AF / #4B5563
 * - Supporting Accents: Emerald (Success), Amber (Warning), Red (Error)
 */

export const GAMBLEPAUSE_THEME = {
  name: 'GamblePause Official Red & White Identity',
  brand: {
    name: 'GamblePause',
    subTitle: 'Africa',
    initiative: 'GamblePause Client Management & Assessment System',
    helpline: '0800-GAMBLE-PAUSE',
    helplineRaw: '0800426253',
    footerTeam: 'GamblePause Digital Team',
  },
  colors: {
    primary: {
      red: '#DC2626',
      redDark: '#B91C1C',
      redLight: '#FEE2E2',
      red50: '#FEF2F2',
      tailwind: {
        bg: 'bg-red-600',
        bgHover: 'hover:bg-red-700',
        text: 'text-red-600',
        textHover: 'hover:text-red-700',
        border: 'border-red-600',
        borderLight: 'border-red-200',
        badge: 'bg-red-50 text-red-700 border-red-200',
        ring: 'focus:ring-red-500',
      },
    },
    secondary: {
      white: '#FFFFFF',
      tailwind: {
        bg: 'bg-white',
        text: 'text-white',
      },
    },
    neutralDark: {
      main: '#111827',
      darker: '#09090B',
      card: '#1F2937',
      tailwind: {
        bg: 'bg-gray-900',
        text: 'text-gray-900',
      },
    },
    neutralGrey: {
      canvas: '#F9FAFB',
      surface: '#F3F4F6',
      border: '#E5E7EB',
      textMuted: '#6B7280',
      tailwind: {
        canvas: 'bg-gray-50',
        border: 'border-gray-200',
        textMuted: 'text-gray-500',
      },
    },
    status: {
      success: {
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        indicator: 'bg-emerald-500',
        text: 'text-emerald-700',
      },
      warning: {
        badge: 'bg-amber-50 text-amber-800 border-amber-200',
        indicator: 'bg-amber-500',
        text: 'text-amber-800',
      },
      error: {
        badge: 'bg-red-50 text-red-700 border-red-200',
        indicator: 'bg-red-600',
        text: 'text-red-700',
      },
    },
  },
  typography: {
    fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  },
} as const;

export default GAMBLEPAUSE_THEME;
