import { useEffect, useState } from 'react';
import { breakpoints } from '@/lib/viewport';

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);

  return matches;
}

export function useBreakpoint(breakpoint: keyof typeof breakpoints) {
  const matches = useMediaQuery(`(min-width: ${breakpoints[breakpoint]}px)`);
  return matches;
}

export function useIsMobile() {
  const isMobile = useMediaQuery(`(max-width: ${breakpoints.md - 1}px)`);
  return isMobile;
}

export function useSafeArea() {
  const [safeArea, setSafeArea] = useState({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  });

  useEffect(() => {
    function updateSafeArea() {
      setSafeArea({
        top: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat') || '0'),
        right: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sar') || '0'),
        bottom: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sab') || '0'),
        left: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sal') || '0'),
      });
    }

    updateSafeArea();
    window.addEventListener('resize', updateSafeArea);
    return () => window.removeEventListener('resize', updateSafeArea);
  }, []);

  return safeArea;
}