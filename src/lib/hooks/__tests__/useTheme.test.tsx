import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, useTheme } from '../useTheme';

function ThemeProbe() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button type="button" onClick={toggleTheme}>
      theme:{theme}
    </button>
  );
}

function renderWithProvider() {
  return render(
    <ThemeProvider>
      <ThemeProbe />
    </ThemeProvider>
  );
}

describe('ThemeProvider / useTheme', () => {
  it('defaults to light when nothing is stored', () => {
    renderWithProvider();

    expect(screen.getByRole('button')).toHaveTextContent('theme:light');
  });

  it('restores a saved theme and reflects it on the document element', () => {
    localStorage.setItem('mentorq_theme', 'dark');

    renderWithProvider();

    expect(screen.getByRole('button')).toHaveTextContent('theme:dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  it('ignores an unrecognised stored value', () => {
    localStorage.setItem('mentorq_theme', 'neon');

    renderWithProvider();

    expect(screen.getByRole('button')).toHaveTextContent('theme:light');
    expect(document.documentElement).not.toHaveAttribute('data-theme');
  });

  it('toggles between themes and persists the choice', async () => {
    const user = userEvent.setup();
    renderWithProvider();
    const button = screen.getByRole('button');

    await user.click(button);

    expect(button).toHaveTextContent('theme:dark');
    expect(localStorage.getItem('mentorq_theme')).toBe('dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');

    await user.click(button);

    expect(button).toHaveTextContent('theme:light');
    expect(localStorage.getItem('mentorq_theme')).toBe('light');
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });

  it('renders children even before the provider has mounted', () => {
    // The provider short-circuits on the first pass to avoid a theme flash;
    // children must still be present in that pass.
    act(() => {
      renderWithProvider();
    });

    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
