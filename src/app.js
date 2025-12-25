/**
 * BACEN Navigator - Navegador de Normativas do Banco Central
 * Inspirado no MITRE ATT&CK Navigator
 */

class BACENNavigator {
    constructor() {
        this.normativas = [];
        this.filteredNormativas = [];
        this.currentView = 'matrix';
        this.months = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        this.types = [
            { id: 'cmn', name: 'Resolução CMN', pattern: /Resolução CMN/i },
            { id: 'bcb', name: 'Resolução BCB', pattern: /Resolução BCB/i },
            { id: 'in', name: 'Instrução Normativa BCB', pattern: /Instrução Normativa/i }
        ];
        
        this.init();
    }

    async init() {
        await this.loadData();
        this.setupEventListeners();
        this.applyFilters();
        this.updateStats();
    }

    async loadData() {
        try {
            const response = await fetch('../normativas_2025.json');
            this.normativas = await response.json();
            console.log(`Carregadas ${this.normativas.length} normativas`);
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            // Tentar caminho alternativo
            try {
                const response = await fetch('./normativas_2025.json');
                this.normativas = await response.json();
            } catch (e) {
                console.error('Erro ao carregar dados (caminho alternativo):', e);
                this.normativas = [];
            }
        }
    }

    setupEventListeners() {
        // Mobile menu toggle
        const btnMenu = document.getElementById('btn-menu');
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        
        if (btnMenu) {
            btnMenu.addEventListener('click', () => {
                sidebar.classList.toggle('open');
                overlay.classList.toggle('active');
            });
        }
        
        if (overlay) {
            overlay.addEventListener('click', () => {
                sidebar.classList.remove('open');
                overlay.classList.remove('active');
            });
        }

        // Search
        document.getElementById('search-input').addEventListener('input', (e) => {
            this.applyFilters();
        });

        // Type filters
        ['filter-cmn', 'filter-bcb', 'filter-in'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => this.applyFilters());
        });

        // Month filter
        document.getElementById('filter-month').addEventListener('change', () => this.applyFilters());

        // Clear filters
        document.getElementById('btn-clear-filters').addEventListener('click', () => this.clearFilters());

        // View toggles
        document.getElementById('btn-matrix-view').addEventListener('click', () => this.switchView('matrix'));
        document.getElementById('btn-list-view').addEventListener('click', () => this.switchView('list'));
        document.getElementById('btn-timeline-view').addEventListener('click', () => this.switchView('timeline'));

        // Modals
        document.getElementById('modal-close').addEventListener('click', () => this.closeModal('detail-modal'));
        document.getElementById('btn-close-modal').addEventListener('click', () => this.closeModal('detail-modal'));
        document.getElementById('btn-help').addEventListener('click', () => this.openModal('help-modal'));
        document.getElementById('help-close').addEventListener('click', () => this.closeModal('help-modal'));
        document.getElementById('btn-close-help').addEventListener('click', () => this.closeModal('help-modal'));

        // Copy link
        document.getElementById('btn-copy-link').addEventListener('click', () => this.copyLink());

        // Export
        document.getElementById('btn-export').addEventListener('click', () => this.exportData());

        // Close modals on backdrop click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });

        // Keyboard events
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
                // Fechar sidebar mobile também
                sidebar.classList.remove('open');
                overlay.classList.remove('active');
            }
        });
        
        // Fechar sidebar ao clicar em um filtro (mobile)
        document.querySelectorAll('.sidebar .checkbox-item, .sidebar select, .sidebar .btn-clear').forEach(el => {
            el.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    setTimeout(() => {
                        sidebar.classList.remove('open');
                        overlay.classList.remove('active');
                    }, 300);
                }
            });
        });
    }

    getType(normativa) {
        for (const type of this.types) {
            if (type.pattern.test(normativa.nome)) {
                return type.id;
            }
        }
        return 'other';
    }

    getMonth(normativa) {
        try {
            const date = new Date(normativa.data);
            return date.getMonth();
        } catch {
            return -1;
        }
    }

    getFormattedDate(normativa) {
        try {
            const date = new Date(normativa.data);
            return date.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return normativa.data;
        }
    }

    applyFilters() {
        const searchText = document.getElementById('search-input').value.toLowerCase();
        const showCMN = document.getElementById('filter-cmn').checked;
        const showBCB = document.getElementById('filter-bcb').checked;
        const showIN = document.getElementById('filter-in').checked;
        const selectedMonth = document.getElementById('filter-month').value;

        this.filteredNormativas = this.normativas.filter(n => {
            // Type filter
            const type = this.getType(n);
            if (type === 'cmn' && !showCMN) return false;
            if (type === 'bcb' && !showBCB) return false;
            if (type === 'in' && !showIN) return false;

            // Month filter
            if (selectedMonth) {
                const month = this.getMonth(n);
                if (month !== parseInt(selectedMonth) - 1) return false;
            }

            // Search filter
            if (searchText) {
                const searchIn = `${n.nome} ${n.descricao}`.toLowerCase();
                if (!searchIn.includes(searchText)) return false;
            }

            return true;
        });

        this.updateStats();
        this.render();
    }

    clearFilters() {
        document.getElementById('search-input').value = '';
        document.getElementById('filter-cmn').checked = true;
        document.getElementById('filter-bcb').checked = true;
        document.getElementById('filter-in').checked = true;
        document.getElementById('filter-month').value = '';
        this.applyFilters();
    }

    updateStats() {
        const total = this.filteredNormativas.length;
        const cmn = this.filteredNormativas.filter(n => this.getType(n) === 'cmn').length;
        const bcb = this.filteredNormativas.filter(n => this.getType(n) === 'bcb').length;
        const inb = this.filteredNormativas.filter(n => this.getType(n) === 'in').length;

        document.getElementById('stat-total').textContent = total;
        document.getElementById('stat-cmn').textContent = cmn;
        document.getElementById('stat-bcb').textContent = bcb;
        document.getElementById('stat-in').textContent = inb;
        document.getElementById('visible-count').textContent = total;
    }

    switchView(view) {
        this.currentView = view;
        
        // Update buttons
        document.querySelectorAll('.btn-view').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`btn-${view}-view`).classList.add('active');

        // Update views
        document.getElementById('matrix-view').classList.toggle('hidden', view !== 'matrix');
        document.getElementById('list-view').classList.toggle('hidden', view !== 'list');
        document.getElementById('timeline-view').classList.toggle('hidden', view !== 'timeline');

        this.render();
    }

    render() {
        switch (this.currentView) {
            case 'matrix':
                this.renderMatrix();
                break;
            case 'list':
                this.renderList();
                break;
            case 'timeline':
                this.renderTimeline();
                break;
        }
    }

    renderMatrix() {
        const container = document.getElementById('matrix-view');
        
        // Organizar dados por tipo e mês
        const data = {};
        this.types.forEach(type => {
            data[type.id] = {};
            for (let m = 0; m < 12; m++) {
                data[type.id][m] = [];
            }
        });

        this.filteredNormativas.forEach(n => {
            const type = this.getType(n);
            const month = this.getMonth(n);
            if (type !== 'other' && month >= 0 && data[type] && data[type][month]) {
                data[type][month].push(n);
            }
        });

        // Determinar meses com dados
        const monthsWithData = new Set();
        this.filteredNormativas.forEach(n => {
            const month = this.getMonth(n);
            if (month >= 0) monthsWithData.add(month);
        });
        const activeMonths = Array.from(monthsWithData).sort((a, b) => a - b);

        if (activeMonths.length === 0) {
            container.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-secondary);">Nenhuma normativa encontrada com os filtros atuais.</div>';
            return;
        }

        // Construir HTML da matriz
        const cols = activeMonths.length + 1;
        let html = `<div class="matrix" style="grid-template-columns: 180px repeat(${activeMonths.length}, minmax(120px, 1fr));">`;

        // Header row
        html += '<div class="matrix-header-cell">Tipo / Mês</div>';
        activeMonths.forEach(m => {
            html += `<div class="matrix-header-cell">${this.months[m]}</div>`;
        });

        // Data rows
        this.types.forEach(type => {
            html += `<div class="matrix-type-cell"><span class="legend-color ${type.id}-bg" style="margin-right: 8px;"></span>${type.name}</div>`;
            
            activeMonths.forEach(m => {
                const items = data[type.id][m];
                const count = items.length;
                
                if (count === 0) {
                    html += '<div class="matrix-cell empty">-</div>';
                } else {
                    html += `<div class="matrix-cell" data-type="${type.id}" data-month="${m}">`;
                    html += `<span class="cell-count">${count}</span>`;
                    
                    // Mostrar até 3 itens
                    const showItems = items.slice(0, 3);
                    showItems.forEach(item => {
                        const shortName = this.getShortName(item.nome);
                        html += `<div class="cell-item ${type.id}" data-id="${item.id}" title="${item.nome}">${shortName}</div>`;
                    });
                    
                    if (count > 3) {
                        html += `<div class="cell-more">+${count - 3} mais</div>`;
                    }
                    
                    html += '</div>';
                }
            });
        });

        html += '</div>';
        container.innerHTML = html;

        // Add event listeners to cells
        container.querySelectorAll('.cell-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = item.dataset.id;
                const normativa = this.normativas.find(n => n.id === id);
                if (normativa) this.showDetail(normativa);
            });

            item.addEventListener('mouseenter', (e) => this.showTooltip(e, item.dataset.id));
            item.addEventListener('mouseleave', () => this.hideTooltip());
        });

        container.querySelectorAll('.matrix-cell:not(.empty)').forEach(cell => {
            cell.addEventListener('click', () => {
                const type = cell.dataset.type;
                const month = parseInt(cell.dataset.month);
                this.showCellItems(type, month);
            });
        });
    }

    getShortName(nome) {
        // Extrair número da normativa (incluindo números com ponto, ex: 5.224)
        const match = nome.match(/N°?\s*([\d.]+)/i);
        if (match) {
            return `Nº ${match[1]}`;
        }
        return nome.substring(0, 15) + '...';
    }

    renderList() {
        const tbody = document.getElementById('list-body');
        
        // Ordenar por data (mais recente primeiro)
        const sorted = [...this.filteredNormativas].sort((a, b) => 
            new Date(b.data) - new Date(a.data)
        );

        let html = '';
        sorted.forEach(n => {
            const type = this.getType(n);
            const typeName = this.types.find(t => t.id === type)?.name || 'Outro';
            
            html += `
                <tr data-id="${n.id}">
                    <td><span class="badge ${type}">${typeName}</span></td>
                    <td>${n.nome}</td>
                    <td>${this.getFormattedDate(n)}</td>
                    <td class="description" title="${n.descricao}">${n.descricao}</td>
                    <td>
                        <button class="btn-action btn-detail" data-id="${n.id}">
                            <i class="fas fa-eye"></i> Ver
                        </button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html || '<tr><td colspan="5" style="text-align: center;">Nenhuma normativa encontrada</td></tr>';

        // Add event listeners
        tbody.querySelectorAll('.btn-detail').forEach(btn => {
            btn.addEventListener('click', () => {
                const normativa = this.normativas.find(n => n.id === btn.dataset.id);
                if (normativa) this.showDetail(normativa);
            });
        });
    }

    renderTimeline() {
        const container = document.getElementById('timeline-content');
        
        // Agrupar por mês
        const byMonth = {};
        this.filteredNormativas.forEach(n => {
            const month = this.getMonth(n);
            if (!byMonth[month]) byMonth[month] = [];
            byMonth[month].push(n);
        });

        // Ordenar meses (mais recente primeiro)
        const sortedMonths = Object.keys(byMonth).map(Number).sort((a, b) => b - a);

        let html = '';
        sortedMonths.forEach(month => {
            const items = byMonth[month].sort((a, b) => new Date(b.data) - new Date(a.data));
            
            html += `
                <div class="timeline-month">
                    <div class="timeline-month-header">${this.months[month]} 2025</div>
            `;

            items.forEach(n => {
                const type = this.getType(n);
                html += `
                    <div class="timeline-item ${type}" data-id="${n.id}">
                        <div class="timeline-item-header">
                            <span class="timeline-item-title">${n.nome}</span>
                            <span class="timeline-item-date">${this.getFormattedDate(n)}</span>
                        </div>
                        <div class="timeline-item-description">${n.descricao}</div>
                    </div>
                `;
            });

            html += '</div>';
        });

        container.innerHTML = html || '<div style="padding: 2rem; text-align: center; color: var(--text-secondary);">Nenhuma normativa encontrada</div>';

        // Add event listeners
        container.querySelectorAll('.timeline-item').forEach(item => {
            item.addEventListener('click', () => {
                const normativa = this.normativas.find(n => n.id === item.dataset.id);
                if (normativa) this.showDetail(normativa);
            });
        });
    }

    showCellItems(typeId, month) {
        // Filtrar normativas desta célula
        const items = this.filteredNormativas.filter(n => {
            return this.getType(n) === typeId && this.getMonth(n) === month;
        });

        if (items.length === 1) {
            this.showDetail(items[0]);
        } else if (items.length > 1) {
            // Mostrar lista no modal
            const typeName = this.types.find(t => t.id === typeId)?.name || 'Normativas';
            const monthName = this.months[month];
            
            const modal = document.getElementById('detail-modal');
            document.getElementById('modal-title').textContent = `${typeName} - ${monthName} 2025`;
            
            const body = document.querySelector('#detail-modal .modal-body');
            body.innerHTML = `
                <p style="margin-bottom: 1rem; color: var(--text-secondary);">${items.length} normativas encontradas:</p>
                <div class="cell-items-list">
                    ${items.map(n => `
                        <div class="timeline-item ${typeId}" data-id="${n.id}" style="cursor: pointer;">
                            <div class="timeline-item-header">
                                <span class="timeline-item-title">${n.nome}</span>
                                <span class="timeline-item-date">${this.getFormattedDate(n)}</span>
                            </div>
                            <div class="timeline-item-description">${n.descricao.substring(0, 150)}...</div>
                        </div>
                    `).join('')}
                </div>
            `;

            // Add click listeners
            body.querySelectorAll('.timeline-item').forEach(item => {
                item.addEventListener('click', () => {
                    const normativa = this.normativas.find(n => n.id === item.dataset.id);
                    if (normativa) this.showDetail(normativa);
                });
            });

            document.querySelector('#detail-modal .modal-footer').style.display = 'none';
            modal.classList.add('active');
        }
    }

    showDetail(normativa) {
        const type = this.getType(normativa);
        const typeName = this.types.find(t => t.id === type)?.name || 'Outro';

        document.getElementById('modal-title').textContent = 'Detalhes da Normativa';
        
        const body = document.querySelector('#detail-modal .modal-body');
        body.innerHTML = `
            <div class="detail-row">
                <label>Tipo:</label>
                <span class="badge ${type}">${typeName}</span>
            </div>
            <div class="detail-row">
                <label>Nome:</label>
                <span>${normativa.nome}</span>
            </div>
            <div class="detail-row">
                <label>Data:</label>
                <span>${this.getFormattedDate(normativa)}</span>
            </div>
            <div class="detail-row">
                <label>Descrição:</label>
                <p>${normativa.descricao}</p>
            </div>
            <div class="detail-row">
                <label>Link:</label>
                <a href="${normativa.link}" target="_blank" id="modal-link">
                    <i class="fas fa-external-link-alt"></i> Acessar Normativa no site do BCB
                </a>
            </div>
        `;

        document.querySelector('#detail-modal .modal-footer').style.display = 'flex';
        
        // Atualizar link para copiar
        this.currentNormativaLink = normativa.link;
        
        document.getElementById('detail-modal').classList.add('active');
    }

    showTooltip(e, id) {
        const normativa = this.normativas.find(n => n.id === id);
        if (!normativa) return;

        const tooltip = document.getElementById('tooltip');
        tooltip.querySelector('.tooltip-content').innerHTML = `
            <div class="tooltip-title">${normativa.nome}</div>
            <div class="tooltip-description">${normativa.descricao.substring(0, 150)}...</div>
        `;

        tooltip.style.left = `${e.pageX + 10}px`;
        tooltip.style.top = `${e.pageY + 10}px`;
        tooltip.classList.add('visible');
    }

    hideTooltip() {
        document.getElementById('tooltip').classList.remove('visible');
    }

    openModal(id) {
        document.getElementById(id).classList.add('active');
    }

    closeModal(id) {
        document.getElementById(id).classList.remove('active');
    }

    copyLink() {
        if (this.currentNormativaLink) {
            navigator.clipboard.writeText(this.currentNormativaLink).then(() => {
                const btn = document.getElementById('btn-copy-link');
                const originalHTML = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-check"></i> Copiado!';
                setTimeout(() => {
                    btn.innerHTML = originalHTML;
                }, 2000);
            });
        }
    }

    exportData() {
        const data = {
            exportDate: new Date().toISOString(),
            totalNormativas: this.filteredNormativas.length,
            normativas: this.filteredNormativas.map(n => ({
                nome: n.nome,
                data: this.getFormattedDate(n),
                tipo: this.types.find(t => t.id === this.getType(n))?.name || 'Outro',
                descricao: n.descricao,
                link: n.link
            }))
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `normativas_bacen_export_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Inicializar aplicação
document.addEventListener('DOMContentLoaded', () => {
    window.navigator = new BACENNavigator();
});
