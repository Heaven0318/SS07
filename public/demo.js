const initialTheme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
window.SS07_CONFIG = { theme: initialTheme, navigation: { about:'#about',projects:'#projects',skills:'#skills',contact:'#contact' } };
document.documentElement.dataset.theme = initialTheme;
const themeButton = document.getElementById('theme');
function themeLabel() { themeButton.textContent = document.documentElement.dataset.theme === 'dark' ? 'Light mode ◑' : 'Dark mode ◐'; themeButton.setAttribute('aria-label',document.documentElement.dataset.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'); }
themeLabel();
themeButton.onclick = () => { const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = next; window.SS07?.setTheme(next); themeLabel(); };
document.getElementById('open').onclick = () => window.SS07?.open();
