export function createActivityCard(stats: any, onClick: () => void) {
    const card = document.createElement('div');
    card.className = 'activity-card';
    card.innerHTML = `
        <div class="card-info">
            <span class="card-title">${stats.title}</span>
            <span class="card-meta">${stats.mainValue} • ${stats.type}</span>
        </div>
        <span class="card-arrow">→</span>
    `;

    card.addEventListener('click', onClick);
    return card;
}
