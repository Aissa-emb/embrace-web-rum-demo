export interface NetworkProfile {
  name: string;
  weight: number;
  downKbps: number;
  upKbps: number;
  rttMs: number;
  cpuThrottle: number;
}

export const networkProfiles: NetworkProfile[] = [
  { name: 'cable',    weight: 35, downKbps: 5000,  upKbps: 1000,  rttMs: 28,  cpuThrottle: 1 },
  { name: 'fast-4g',  weight: 25, downKbps: 9000,  upKbps: 1500,  rttMs: 85,  cpuThrottle: 2 },
  { name: 'slow-4g',  weight: 20, downKbps: 1600,  upKbps: 750,   rttMs: 150, cpuThrottle: 4 },
  { name: 'fast-3g',  weight: 10, downKbps: 1500,  upKbps: 750,   rttMs: 300, cpuThrottle: 4 },
  { name: 'slow-3g',  weight: 5,  downKbps: 500,   upKbps: 500,   rttMs: 400, cpuThrottle: 6 },
  { name: 'wifi',     weight: 5,  downKbps: 30000, upKbps: 15000, rttMs: 10,  cpuThrottle: 1 },
];

/**
 * Apply network + CPU throttling to a page via Chrome DevTools Protocol.
 */
export async function applyNetworkProfile(
  page: import('playwright').Page,
  profile: NetworkProfile
): Promise<void> {
  const cdp = await page.context().newCDPSession(page);

  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: (profile.downKbps * 1024) / 8,
    uploadThroughput: (profile.upKbps * 1024) / 8,
    latency: profile.rttMs,
  });

  if (profile.cpuThrottle > 1) {
    await cdp.send('Emulation.setCPUThrottlingRate', {
      rate: profile.cpuThrottle,
    });
  }
}
