'use strict';
const preview = document.documentElement.dataset.ss07Preview === 'true';
window.SS07_CONFIG = { theme:'light', previewOnly:preview, navigation:{about:'#about',projects:'#projects',skills:'#skills',contact:'#contact'} };
if (preview) {
  document.getElementById('deployment-label').textContent = 'Private showcase preview';
  document.getElementById('deployment-detail').textContent = 'The interface is ready to explore. AI replies are unavailable until the independent backend is connected.';
}
for (const id of ['try','try-again']) document.getElementById(id).onclick = () => window.SS07?.open();
