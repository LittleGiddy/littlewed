export const GUEST_PAGE_FONTS = [
  'Playfair Display', 'DM Sans', 'Roboto', 'Lora', 'Montserrat',
  'Georgia', 'Open Sans', 'Raleway', 'Nunito', 'Poppins',
  'Great Vibes', 'Parisienne', 'Alex Brush', 'Tangerine',
  'Dancing Script', 'Pacifico', 'Satisfy', 'Cedarville Cursive', 'Kaushan Script',
] as const;

export const FONT_STACKS: Record<string, string> = {
  'Playfair Display': '"Playfair Display", Georgia, serif',
  'DM Sans': '"DM Sans", sans-serif',
  'Roboto': 'Roboto, sans-serif',
  'Lora': '"Lora", serif',
  'Montserrat': 'Montserrat, sans-serif',
  'Georgia': 'Georgia, serif',
  'Open Sans': '"Open Sans", sans-serif',
  'Raleway': 'Raleway, sans-serif',
  'Nunito': 'Nunito, sans-serif',
  'Poppins': 'Poppins, sans-serif',
  'Great Vibes': '"Great Vibes", cursive',
  'Parisienne': '"Parisienne", cursive',
  'Alex Brush': '"Alex Brush", cursive',
  'Tangerine': '"Tangerine", cursive',
  'Dancing Script': '"Dancing Script", cursive',
  'Pacifico': '"Pacifico", cursive',
  'Satisfy': '"Satisfy", cursive',
  'Cedarville Cursive': '"Cedarville Cursive", cursive',
  'Kaushan Script': '"Kaushan Script", cursive',
};

export function fontStack(fontFamily: string | null | undefined): string {
  if (!fontFamily) return FONT_STACKS['Playfair Display'];
  return FONT_STACKS[fontFamily] || FONT_STACKS['Playfair Display'];
}

export function googleFontsImport(fontFamily: string | null | undefined): string {
  const font = fontFamily && FONT_STACKS[fontFamily] ? fontFamily : 'Playfair Display';
  const family = font.replace(/ /g, '+');
  return `@import url('https://fonts.googleapis.com/css2?family=${family}:wght@400;500;600;700;800;900&display=swap');`;
}