export type NavigationLabelKey = 'about' | 'consulting';

export type NavigationItem = {
  labelKey: NavigationLabelKey;
  href: string;
};

export const primaryNavigation: NavigationItem[] = [
  { labelKey: 'about', href: '/about' },
  { labelKey: 'consulting', href: '/consulting' },
];
