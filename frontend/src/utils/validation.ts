import validator from 'validator';

/**
 * Validate email address using the validator library.
 */
export const isValidEmail = (email: string): boolean =>
  validator.isEmail(email);

/**
 * Validate URL using the validator library.
 */
export const isValidUrl = (url: string): boolean => validator.isURL(url);

/**
 * Validate Docker container name format.
 * Docker names must match: [a-zA-Z0-9][a-zA-Z0-9_.-]*
 */
export const isValidContainerName = (name: string): boolean => {
  const nameRegex = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;
  return nameRegex.test(name) && name.length > 0 && name.length <= 255;
};

/**
 * Validate port number (1-65535).
 */
export const isValidPort = (port: number | string): boolean =>
  validator.isPort(String(port));
