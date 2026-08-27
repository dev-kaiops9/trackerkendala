    tailwind.config = {
      theme: {
        extend: {
          fontFamily: { sans: ['Plus Jakarta Sans', 'sans-serif'] },
          colors: {
            app: {
              bg: '#f2f0f9',
              surface: '#ffffff',
              primary: '#FF6F48',
              primaryDark: '#E85A34',
              accentPurple: '#FF9B76',
              cardPurple: '#FFE8DE',
              cardBlue: '#e0f2fe',
              cardYellow: '#fef3c7',
              cardGreen: '#d1fae5',
              darkCard: '#2A2140',
            }
          },
          boxShadow: {
            'soft-widget': '0 12px 30px -10px rgba(255, 111, 72, 0.10), 0 4px 12px -2px rgba(0,0,0,0.03)',
            'purple-glow': '0 10px 25px -5px rgba(255, 111, 72, 0.35)',
          }
        }
      }
    }
