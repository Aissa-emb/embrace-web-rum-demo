import { describe, it, expect } from 'vitest';
import { allPersonas } from '../src/personas';

describe('Persona registry', () => {
  it('should have 6 personas', () => {
    expect(allPersonas).toHaveLength(6);
  });

  it('should have weights summing to 100', () => {
    const total = allPersonas.reduce((sum, p) => sum + p.weight, 0);
    expect(total).toBe(100);
  });

  it('should have unique names', () => {
    const names = allPersonas.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  const expectedPersonas = ['browser', 'buyer', 'cart-abandoner', 'searcher', 'bouncer', 'power-user'];
  for (const name of expectedPersonas) {
    it(`should include "${name}" persona`, () => {
      expect(allPersonas.find((p) => p.name === name)).toBeDefined();
    });
  }
});
