import {definePreset} from '@primeng/themes';
import Aura from '@primeng/themes/aura';

export const AppPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#f3e8fd',
      100: '#e4cffc',
      200: '#c9a0f9',
      300: '#ad70f6',
      400: '#8f3ff2',
      500: '#6200ea',
      600: '#5600cf',
      700: '#4a00b3',
      800: '#3d0094',
      900: '#310076',
      950: '#22004f'
    },
    colorScheme: {
      dark: {
        primary: {
          color: '{primary.400}',
          contrastColor: '#ffffff',
          hoverColor: '{primary.300}',
          activeColor: '{primary.200}'
        },
        surface: {
          0: '#ffffff',
          50: '#f5f4f8',
          100: '#e9e7f0',
          200: '#d4d1e0',
          300: '#b3afc4',
          400: '#8b86a0',
          500: '#67627d',
          600: '#4c4862',
          700: '#34314a',
          800: '#252238',
          900: '#1a1829',
          950: '#110f1c'
        }
      }
    }
  }
});
