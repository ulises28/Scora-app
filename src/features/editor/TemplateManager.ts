type OnChangeCallback = (template: string, color: string) => void;

export function initTemplateManager(onChange: OnChangeCallback) {
    let currentTemplate = 'minimal';
    let currentTextColor = 'white';

    // Manejo de selección de templates
    document.querySelectorAll('.template-item').forEach(item => {
        item.addEventListener('click', (e) => {
            document.querySelector('.template-item.active')?.classList.remove('active');
            const target = e.target as HTMLElement;
            target.classList.add('active');

            currentTemplate = target.innerText.trim().toLowerCase();
            onChange(currentTemplate, currentTextColor);
        });
    });

    // Manejo de color de texto
    const textColorSelect = document.getElementById('text-color-select');
    if (textColorSelect) {
        textColorSelect.addEventListener('change', (e) => {
            currentTextColor = (e.target as HTMLSelectElement).value;
            onChange(currentTemplate, currentTextColor);
        });
    }

    return {
        get template() { return currentTemplate; },
        get color() { return currentTextColor; },
        setTemplate(template: string) {
            currentTemplate = template;
            document.querySelectorAll('.template-item').forEach(item => {
                if ((item as HTMLElement).innerText.trim().toLowerCase() === currentTemplate) {
                    item.classList.add('active');
                } else {
                    item.classList.remove('active');
                }
            });
        }
    };
}
