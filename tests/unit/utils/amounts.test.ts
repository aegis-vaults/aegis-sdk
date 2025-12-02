/**
 * Unit tests for amount conversion utilities
 */

import { BN } from '@coral-xyz/anchor';
import {
  solToLamports,
  lamportsToSol,
  formatLamports,
  parseSolString,
  calculateFee,
  calculateNetAmount,
  isValidAmount,
  LAMPORTS_PER_SOL,
} from '../../../src/utils/amounts';

describe('amounts utilities', () => {
  describe('solToLamports', () => {
    it('should convert SOL to lamports', () => {
      expect(solToLamports(1).toString()).toBe('1000000000');
      expect(solToLamports(0.5).toString()).toBe('500000000');
      expect(solToLamports(1.5).toString()).toBe('1500000000');
    });

    it('should handle decimal places correctly', () => {
      expect(solToLamports(0.000000001).toString()).toBe('1');
      expect(solToLamports(0.123456789).toString()).toBe('123456789');
    });
  });

  describe('lamportsToSol', () => {
    it('should convert lamports to SOL (BN)', () => {
      expect(lamportsToSol(new BN(1000000000))).toBe(1);
      expect(lamportsToSol(new BN(500000000))).toBe(0.5);
    });

    it('should convert lamports to SOL (number)', () => {
      expect(lamportsToSol(1000000000)).toBe(1);
      expect(lamportsToSol(500000000)).toBe(0.5);
    });

    it('should convert lamports to SOL (bigint)', () => {
      expect(lamportsToSol(1000000000n)).toBe(1);
      expect(lamportsToSol(500000000n)).toBe(0.5);
    });
  });

  describe('formatLamports', () => {
    it('should format lamports as SOL string', () => {
      expect(formatLamports(new BN(1000000000))).toBe('1.0000 SOL');
      expect(formatLamports(new BN(500000000))).toBe('0.5000 SOL');
    });

    it('should respect decimal places parameter', () => {
      expect(formatLamports(new BN(1500000000), 2)).toBe('1.50 SOL');
      expect(formatLamports(new BN(1234567890), 6)).toBe('1.234568 SOL');
    });
  });

  describe('parseSolString', () => {
    it('should parse SOL string to lamports', () => {
      expect(parseSolString('1').toString()).toBe('1000000000');
      expect(parseSolString('0.5').toString()).toBe('500000000');
      expect(parseSolString('1.5 SOL').toString()).toBe('1500000000');
    });

    it('should throw on invalid input', () => {
      expect(() => parseSolString('invalid')).toThrow('Invalid SOL amount');
      expect(() => parseSolString('abc SOL')).toThrow('Invalid SOL amount');
    });
  });

  describe('calculateFee', () => {
    it('should calculate fee correctly', () => {
      // 0.05% of 1 SOL = 500,000 lamports
      const fee = calculateFee(new BN(1000000000), 5);
      expect(fee.toString()).toBe('500000');
    });

    it('should handle different fee basis points', () => {
      const amount = new BN(1000000000);
      expect(calculateFee(amount, 10).toString()).toBe('1000000'); // 0.1%
      expect(calculateFee(amount, 100).toString()).toBe('10000000'); // 1%
    });
  });

  describe('calculateNetAmount', () => {
    it('should calculate net amount after fee', () => {
      const netAmount = calculateNetAmount(new BN(1000000000), 5);
      expect(netAmount.toString()).toBe('999500000');
    });
  });

  describe('isValidAmount', () => {
    it('should validate amounts correctly', () => {
      expect(isValidAmount(new BN(1000000))).toBe(true);
      expect(isValidAmount(new BN(0))).toBe(false);
      expect(isValidAmount(new BN(-100))).toBe(false);
    });

    it('should respect min/max bounds', () => {
      expect(isValidAmount(new BN(500), new BN(1000))).toBe(false);
      expect(isValidAmount(new BN(1500), new BN(1000), new BN(2000))).toBe(true);
    });
  });
});
