import { devices } from 'playwright';

export interface DeviceProfile {
  name: string;
  weight: number;
  descriptor: {
    viewport: { width: number; height: number };
    deviceScaleFactor?: number;
    isMobile?: boolean;
    hasTouch?: boolean;
    userAgent?: string;
  };
}

const desktop1080: DeviceProfile = {
  name: 'desktop-1080p',
  weight: 30,
  descriptor: {
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  },
};

const desktop1440: DeviceProfile = {
  name: 'desktop-1440p',
  weight: 15,
  descriptor: {
    viewport: { width: 2560, height: 1440 },
    deviceScaleFactor: 2,
    isMobile: false,
    hasTouch: false,
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  },
};

const macbook13: DeviceProfile = {
  name: 'macbook-13',
  weight: 15,
  descriptor: {
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    isMobile: false,
    hasTouch: false,
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  },
};

function fromPlaywright(name: string, weight: number, key: string): DeviceProfile {
  const d = devices[key];
  return {
    name,
    weight,
    descriptor: {
      viewport: d.viewport,
      deviceScaleFactor: d.deviceScaleFactor,
      isMobile: d.isMobile,
      hasTouch: d.hasTouch,
      userAgent: d.userAgent,
    },
  };
}

export const deviceProfiles: DeviceProfile[] = [
  desktop1080,
  desktop1440,
  macbook13,
  fromPlaywright('iphone-14', 15, 'iPhone 14'),
  fromPlaywright('iphone-se', 10, 'iPhone SE'),
  fromPlaywright('pixel-7', 10, 'Pixel 7'),
  fromPlaywright('galaxy-s9', 5, 'Galaxy S9+'),
];
