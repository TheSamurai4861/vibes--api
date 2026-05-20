export class UpstreamError extends Error {
  /**
   * @param {string} source - Upstream identifier (e.g. deezer)
   * @param {string} message - Human-readable message
   * @param {number} [httpStatus] - Optional HTTP status from upstream
   */
  constructor(source, message, httpStatus) {
    super(message);
    this.name = 'UpstreamError';
    this.source = source;
    this.httpStatus = httpStatus;
  }
}

export class ValidationError extends Error {
  /**
   * @param {string} message
   * @param {string} [field]
   */
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}
