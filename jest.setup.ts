import '@testing-library/jest-dom';

// Tests must never reach the network. Individual suites override this with
// their own mock implementation when they need a response body.
beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.reject(new Error('Unexpected network call in test'))
  ) as unknown as typeof fetch;
});

afterEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});
