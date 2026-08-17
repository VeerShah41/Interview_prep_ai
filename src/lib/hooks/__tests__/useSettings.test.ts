import { act, renderHook } from '@testing-library/react';
import { useSettings } from '../useSettings';

describe('useSettings', () => {
  it('exposes defaults and marks itself loaded', () => {
    const { result } = renderHook(() => useSettings());

    expect(result.current.settings).toEqual({
      customApiKey: '',
      preferredModel: 'llama-3.3-70b-versatile',
      difficultyLevel: 'intermediate',
    });
    expect(result.current.loaded).toBe(true);
  });

  it('restores settings persisted by a previous session', () => {
    localStorage.setItem(
      'mentorq_settings',
      JSON.stringify({
        customApiKey: 'stored-key',
        preferredModel: 'llama-3.1-8b-instant',
        difficultyLevel: 'master',
      })
    );

    const { result } = renderHook(() => useSettings());

    expect(result.current.settings.preferredModel).toBe('llama-3.1-8b-instant');
    expect(result.current.settings.difficultyLevel).toBe('master');
  });

  it('falls back to defaults when stored settings are corrupt', () => {
    localStorage.setItem('mentorq_settings', '{not json');

    const { result } = renderHook(() => useSettings());

    expect(result.current.settings.difficultyLevel).toBe('intermediate');
    expect(result.current.loaded).toBe(true);
  });

  it('merges partial updates and writes them back to storage', () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.updateSettings({ difficultyLevel: 'easy' });
    });

    expect(result.current.settings.difficultyLevel).toBe('easy');
    // Untouched fields survive the merge.
    expect(result.current.settings.preferredModel).toBe('llama-3.3-70b-versatile');
    expect(JSON.parse(localStorage.getItem('mentorq_settings')!)).toEqual({
      customApiKey: '',
      preferredModel: 'llama-3.3-70b-versatile',
      difficultyLevel: 'easy',
    });
  });
});
