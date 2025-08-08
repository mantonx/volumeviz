/**
 * Tests for validation utility functions
 */

import {
  isValidEmail,
  isValidUrl,
  isValidContainerName,
  isValidPort,
} from './validation';

describe('isValidEmail', () => {
  it('should validate correct email addresses', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('user.name+tag@domain.co.uk')).toBe(true);
    expect(isValidEmail('valid_email@domain.org')).toBe(true);
    expect(isValidEmail('123@numbers.com')).toBe(true);
  });

  it('should reject invalid email addresses', () => {
    expect(isValidEmail('invalid-email')).toBe(false);
    expect(isValidEmail('@domain.com')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
    expect(isValidEmail('user@domain')).toBe(false);
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('user..double.dot@domain.com')).toBe(false);
  });

  it('should handle edge cases', () => {
    expect(isValidEmail('user@domain..com')).toBe(false);
    expect(isValidEmail('user name@domain.com')).toBe(false);
    expect(isValidEmail('user@domain.com.')).toBe(false);
  });
});

describe('isValidUrl', () => {
  it('should validate correct URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://localhost:8080')).toBe(true);
    expect(isValidUrl('https://subdomain.example.co.uk/path?query=value')).toBe(true);
    expect(isValidUrl('ftp://files.example.com')).toBe(true);
    expect(isValidUrl('https://192.168.1.1:3000')).toBe(true);
  });

  it('should reject invalid URLs', () => {
    expect(isValidUrl('not-a-url')).toBe(false);
    expect(isValidUrl('http://')).toBe(false);
    expect(isValidUrl('https://')).toBe(false);
    expect(isValidUrl('')).toBe(false);
    expect(isValidUrl('ftp')).toBe(false);
    expect(isValidUrl('example.com')).toBe(false); // Missing protocol
  });

  it('should handle special cases', () => {
    expect(isValidUrl('http://example')).toBe(true); // Local domains are valid
    expect(isValidUrl('https://example.com:80')).toBe(true);
    expect(isValidUrl('https://example.com/path/to/resource#fragment')).toBe(true);
  });
});

describe('isValidContainerName', () => {
  it('should validate correct container names', () => {
    expect(isValidContainerName('mycontainer')).toBe(true);
    expect(isValidContainerName('my-container')).toBe(true);
    expect(isValidContainerName('my_container')).toBe(true);
    expect(isValidContainerName('my.container')).toBe(true);
    expect(isValidContainerName('container123')).toBe(true);
    expect(isValidContainerName('123container')).toBe(true);
    expect(isValidContainerName('a')).toBe(true);
    expect(isValidContainerName('A')).toBe(true);
  });

  it('should reject invalid container names', () => {
    expect(isValidContainerName('-mycontainer')).toBe(false); // Can't start with dash
    expect(isValidContainerName('.mycontainer')).toBe(false); // Can't start with dot
    expect(isValidContainerName('_mycontainer')).toBe(false); // Can't start with underscore
    expect(isValidContainerName('')).toBe(false); // Empty string
    expect(isValidContainerName('my container')).toBe(false); // Contains space
    expect(isValidContainerName('my@container')).toBe(false); // Contains invalid character
  });

  it('should handle length restrictions', () => {
    const validLongName = 'a'.repeat(255);
    const invalidLongName = 'a'.repeat(256);
    
    expect(isValidContainerName(validLongName)).toBe(true);
    expect(isValidContainerName(invalidLongName)).toBe(false);
  });

  it('should handle mixed characters', () => {
    expect(isValidContainerName('My-Container_123.test')).toBe(true);
    expect(isValidContainerName('a1b2c3-d4e5f6_g7h8i9.test')).toBe(true);
  });
});

describe('isValidPort', () => {
  it('should validate correct port numbers', () => {
    expect(isValidPort(80)).toBe(true);
    expect(isValidPort(443)).toBe(true);
    expect(isValidPort(8080)).toBe(true);
    expect(isValidPort(3000)).toBe(true);
    expect(isValidPort(65535)).toBe(true); // Max port
    expect(isValidPort(1)).toBe(true); // Min port
  });

  it('should validate port numbers as strings', () => {
    expect(isValidPort('80')).toBe(true);
    expect(isValidPort('443')).toBe(true);
    expect(isValidPort('8080')).toBe(true);
    expect(isValidPort('65535')).toBe(true);
  });

  it('should reject invalid port numbers', () => {
    expect(isValidPort(0)).toBe(false); // Too low
    expect(isValidPort(65536)).toBe(false); // Too high
    expect(isValidPort(-1)).toBe(false); // Negative
    expect(isValidPort('0')).toBe(false);
    expect(isValidPort('65536')).toBe(false);
    expect(isValidPort('-1')).toBe(false);
  });

  it('should reject non-numeric strings', () => {
    expect(isValidPort('abc')).toBe(false);
    expect(isValidPort('80a')).toBe(false);
    expect(isValidPort('a80')).toBe(false);
    expect(isValidPort('')).toBe(false);
    expect(isValidPort('80.5')).toBe(false);
  });

  it('should handle edge cases', () => {
    expect(isValidPort('08080')).toBe(true); // Leading zeros are ok
    expect(isValidPort(' 80 ')).toBe(false); // Whitespace
    expect(isValidPort('80 80')).toBe(false); // Multiple numbers
  });
});