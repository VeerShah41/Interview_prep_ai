import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from '../useAuth';

const USER = { id: 'u1', email: 'veer@example.com', name: 'Veer' };

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

function mockJson(ok: boolean, body: unknown) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);
}

describe('AuthProvider / useAuth', () => {
  it('throws when used outside of a provider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used within an AuthProvider'
    );

    consoleError.mockRestore();
  });

  it('starts unauthenticated and stops loading when there is no stored session', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('restores a stored session and revalidates the token', async () => {
    localStorage.setItem('token', 'stored-token');
    localStorage.setItem('user', JSON.stringify(USER));
    (global.fetch as jest.Mock).mockImplementation(() =>
      mockJson(true, { user: { ...USER, name: 'Veer Refreshed' } })
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.token).toBe('stored-token');
    expect(result.current.user?.name).toBe('Veer Refreshed');
    expect(global.fetch).toHaveBeenCalledWith('/api/auth/me', {
      headers: { Authorization: 'Bearer stored-token' },
    });
  });

  it('clears the stored session when the token is rejected', async () => {
    localStorage.setItem('token', 'expired-token');
    localStorage.setItem('user', JSON.stringify(USER));
    (global.fetch as jest.Mock).mockImplementation(() => mockJson(false, {}));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('persists token and user after a successful login', async () => {
    (global.fetch as jest.Mock).mockImplementation(() =>
      mockJson(true, { token: 'fresh-token', user: USER })
    );
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.login('veer@example.com', 'pw');
    });

    expect(result.current.token).toBe('fresh-token');
    expect(result.current.user).toEqual(USER);
    expect(localStorage.getItem('token')).toBe('fresh-token');
    expect(JSON.parse(localStorage.getItem('user')!)).toEqual(USER);
  });

  it('surfaces the server error message when login fails', async () => {
    (global.fetch as jest.Mock).mockImplementation(() =>
      mockJson(false, { error: 'Invalid credentials' })
    );
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      act(async () => {
        await result.current.login('veer@example.com', 'wrong');
      })
    ).rejects.toThrow('Invalid credentials');

    expect(result.current.token).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('logout drops both in-memory and stored credentials', async () => {
    (global.fetch as jest.Mock).mockImplementation(() =>
      mockJson(true, { token: 'fresh-token', user: USER })
    );
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.login('veer@example.com', 'pw');
    });

    act(() => {
      result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
  });
});
