/**
 * BACEN Navigator - Navegador de Normativas do Banco Central
 * Inspirado no MITRE ATT&CK Navigator
 */

class BACENNavigator {
    constructor() {
        this.normativas = [];
        this.filteredNormativas = [];
        this.currentView = 'matrix';
        const availableYears = [...document.querySelectorAll('#year-select option')]
            .map(option => option.value)
            .sort();
        const calendarYear = String(new Date().getFullYear());
        this.currentYear = availableYears.includes(calendarYear)
            ? calendarYear
            : availableYears.at(-1);
        this.months = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        this.types = [
            { id: 'cmn', name: 'Resolução CMN', pattern: /Resolução CMN/i },
            { id: 'bcb', name: 'Resolução BCB', pattern: /Resolução BCB/i },
            { id: 'in', name: 'Instrução Normativa BCB', pattern: /Instrução Normativa/i },
            { id: 'joint', name: 'Resolução Conjunta', pattern: /Resolução Conjunta/i },
            { id: 'other', name: 'Outros', pattern: /.*/i }
        ];
        
        this.init();
    }

    async init() {
        await this.loadData(this.currentYear);
        await this.loadDataStatus();
        this.updateYearUI();
        this.setupEventListeners();
        this.applyFilters();
        this.updateStats();
    }

    async loadDataStatus() {
        const statusElement = document.getElementById('data-updated-at');
        try {
            const response = await fetch('./data-status.json', { cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const status = await response.json();
            const date = new Date(status.updated_at);
            statusElement.textContent = `Dados verificados em ${date.toLocaleString('pt-BR')}`;
        } catch (error) {
            statusElement.textContent = 'Data de atualização indisponível';
            console.warn('Não foi possível carregar o status dos dados:', error);
        }
    }

    async loadData(year) {
        try {
            const response = await fetch(`./normativas_${year}.json`, { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const normativas = await response.json();
            if (!Array.isArray(normativas)) {
                throw new Error('Formato de dados inválido');
            }

            this.normativas = normativas;
            console.log(`Carregadas ${this.normativas.length} normativas de ${year}`);
            return true;
        } catch (error) {
            console.error(`Erro ao carregar normativas de ${year}:`, error);
            return false;
        }
    }

    async changeYear(year) {
        if (year === this.currentYear) return;

        const yearSelect = document.getElementById('year-select');
        const previousYear = this.currentYear;
        yearSelect.disabled = true;

        const loaded = await this.loadData(year);
        yearSelect.disabled = false;

        if (!loaded) {
            yearSelect.value = previousYear;
            window.alert(`Não foi possível carregar as normativas de ${year}.`);
            return;
        }

        this.currentYear = year;
        this.updateYearUI();
        this.closeModal('detail-modal');
        this.hideTooltip();
        this.clearFilters();
    }

    updateYearUI() {
        document.title = `BACEN Navigator - Normativas ${this.currentYear}`;
        document.getElementById('page-title').textContent =
            `Normativas do Banco Central do Brasil - ${this.currentYear}`;
        document.getElementById('help-year').textContent = this.currentYear;
        document.getElementById('year-select').value = this.currentYear;
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

        // Year selector
        document.getElementById('year-select').addEventListener('change', (event) => {
            this.changeYear(event.target.value);
        });

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

    createElement(tagName, className = '', text = '') {
        const element = document.createElement(tagName);
        if (className) element.className = className;
        if (text) element.textContent = text;
        return element;
    }

    createEmptyState(message) {
        return this.createElement('div', 'empty-state', message);
    }

    renderMatrix() {
        const container = document.getElementById('matrix-view');
        container.replaceChildren();
        
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
            container.appendChild(this.createEmptyState('Nenhuma normativa encontrada com os filtros atuais.'));
            return;
        }

        // Construir matriz usando APIs seguras do DOM.
        const matrix = this.createElement('div', 'matrix');
        matrix.style.gridTemplateColumns = `180px repeat(${activeMonths.length}, minmax(120px, 1fr))`;

        // Header row
        matrix.appendChild(this.createElement('div', 'matrix-header-cell', 'Tipo / Mês'));
        activeMonths.forEach(m => {
            matrix.appendChild(this.createElement('div', 'matrix-header-cell', this.months[m]));
        });

        // Data rows
        this.types.forEach(type => {
            const typeCell = this.createElement('div', 'matrix-type-cell');
            const legend = this.createElement('span', `legend-color ${type.id}-bg`);
            legend.style.marginRight = '8px';
            typeCell.append(legend, document.createTextNode(type.name));
            matrix.appendChild(typeCell);
            
            activeMonths.forEach(m => {
                const items = data[type.id][m];
                const count = items.length;
                
                if (count === 0) {
                    matrix.appendChild(this.createElement('div', 'matrix-cell empty', '-'));
                } else {
                    const cell = this.createElement('div', 'matrix-cell');
                    cell.appendChild(this.createElement('span', 'cell-count', String(count)));
                    
                    // Mostrar até 3 itens
                    items.slice(0, 3).forEach(item => {
                        const shortName = this.getShortName(item.nome);
                        const itemElement = this.createElement('div', `cell-item ${type.id}`, shortName);
                        itemElement.title = item.nome;
                        itemElement.addEventListener('click', (event) => {
                            event.stopPropagation();
                            this.showDetail(item);
                        });
                        itemElement.addEventListener('mouseenter', (event) => this.showTooltip(event, item));
                        itemElement.addEventListener('mouseleave', () => this.hideTooltip());
                        cell.appendChild(itemElement);
                    });
                    
                    if (count > 3) {
                        cell.appendChild(this.createElement('div', 'cell-more', `+${count - 3} mais`));
                    }

                    cell.addEventListener('click', () => this.showCellItems(type.id, m));
                    matrix.appendChild(cell);
                }
            });
        });

        container.appendChild(matrix);
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
        tbody.replaceChildren();
        
        // Ordenar por data (mais recente primeiro)
        const sorted = [...this.filteredNormativas].sort((a, b) => 
            new Date(b.data) - new Date(a.data)
        );

        if (sorted.length === 0) {
            const row = document.createElement('tr');
            const cell = this.createElement('td', 'empty-table-cell', 'Nenhuma normativa encontrada');
            cell.colSpan = 5;
            row.appendChild(cell);
            tbody.appendChild(row);
            return;
        }

        sorted.forEach(n => {
            const type = this.getType(n);
            const typeName = this.types.find(t => t.id === type)?.name || 'Outro';

            const row = document.createElement('tr');
            const typeCell = document.createElement('td');
            typeCell.appendChild(this.createElement('span', `badge ${type}`, typeName));
            const nameCell = this.createElement('td', '', n.nome);
            const dateCell = this.createElement('td', '', this.getFormattedDate(n));
            const descriptionCell = this.createElement('td', 'description', n.descricao);
            descriptionCell.title = n.descricao;

            const actionCell = document.createElement('td');
            const button = this.createElement('button', 'btn-action btn-detail');
            const icon = this.createElement('i', 'fas fa-eye');
            button.append(icon, document.createTextNode(' Ver'));
            button.addEventListener('click', () => this.showDetail(n));
            actionCell.appendChild(button);

            row.append(typeCell, nameCell, dateCell, descriptionCell, actionCell);
            tbody.appendChild(row);
        });
    }

    renderTimeline() {
        const container = document.getElementById('timeline-content');
        container.replaceChildren();
        
        // Agrupar por mês
        const byMonth = {};
        this.filteredNormativas.forEach(n => {
            const month = this.getMonth(n);
            if (!byMonth[month]) byMonth[month] = [];
            byMonth[month].push(n);
        });

        // Ordenar meses (mais recente primeiro)
        const sortedMonths = Object.keys(byMonth).map(Number).sort((a, b) => b - a);

        if (sortedMonths.length === 0) {
            container.appendChild(this.createEmptyState('Nenhuma normativa encontrada'));
            return;
        }

        sortedMonths.forEach(month => {
            const items = byMonth[month].sort((a, b) => new Date(b.data) - new Date(a.data));

            const monthElement = this.createElement('div', 'timeline-month');
            monthElement.appendChild(
                this.createElement('div', 'timeline-month-header', `${this.months[month]} ${this.currentYear}`)
            );

            items.forEach(n => {
                const type = this.getType(n);
                const item = this.createTimelineItem(n, type);
                item.addEventListener('click', () => this.showDetail(n));
                monthElement.appendChild(item);
            });

            container.appendChild(monthElement);
        });
    }

    createTimelineItem(normativa, type, descriptionLimit = null) {
        const item = this.createElement('div', `timeline-item ${type}`);
        const header = this.createElement('div', 'timeline-item-header');
        header.append(
            this.createElement('span', 'timeline-item-title', normativa.nome),
            this.createElement('span', 'timeline-item-date', this.getFormattedDate(normativa))
        );

        let description = normativa.descricao;
        if (descriptionLimit !== null && description.length > descriptionLimit) {
            description = `${description.substring(0, descriptionLimit)}...`;
        }

        item.append(header, this.createElement('div', 'timeline-item-description', description));
        return item;
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
            document.getElementById('modal-title').textContent = `${typeName} - ${monthName} ${this.currentYear}`;
            
            const body = document.querySelector('#detail-modal .modal-body');
            body.replaceChildren();
            const summary = this.createElement('p', 'cell-items-summary', `${items.length} normativas encontradas:`);
            const list = this.createElement('div', 'cell-items-list');

            items.forEach(normativa => {
                const item = this.createTimelineItem(normativa, typeId, 150);
                item.addEventListener('click', () => {
                    this.showDetail(normativa);
                });
                list.appendChild(item);
            });

            body.append(summary, list);

            document.querySelector('#detail-modal .modal-footer').style.display = 'none';
            modal.classList.add('active');
        }
    }

    async showDetail(normativa) {
        const requestId = (this.detailRequestId || 0) + 1;
        this.detailRequestId = requestId;
        const type = this.getType(normativa);
        const typeName = this.types.find(t => t.id === type)?.name || 'Outro';

        document.getElementById('modal-title').textContent = 'Detalhes da Normativa';
        
        const body = document.querySelector('#detail-modal .modal-body');
        body.replaceChildren();

        const typeRow = this.createDetailRow('Tipo:');
        typeRow.appendChild(this.createElement('span', `badge ${type}`, typeName));
        const nameRow = this.createDetailRow('Nome:');
        nameRow.appendChild(this.createElement('span', '', normativa.nome));
        const dateRow = this.createDetailRow('Data:');
        dateRow.appendChild(this.createElement('span', '', this.getFormattedDate(normativa)));
        const descriptionRow = this.createDetailRow('Descrição:');
        descriptionRow.appendChild(this.createElement('p', '', normativa.descricao));
        const linkRow = this.createDetailRow('Link:');
        const safeLink = this.getSafeNormativaLink(normativa.link);
        const link = this.createElement('a', '', safeLink ? ' Acessar Normativa no site do BCB' : 'Link indisponível');
        link.id = 'modal-link';
        if (safeLink) {
            link.href = safeLink;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.prepend(this.createElement('i', 'fas fa-external-link-alt'));
        }
        linkRow.appendChild(link);
        body.append(typeRow, nameRow, dateRow, descriptionRow, linkRow);

        const fullContentRow = this.createDetailRow('Texto integral:');
        const loading = this.createElement('p', 'detail-loading', 'Carregando conteúdo verificado...');
        fullContentRow.appendChild(loading);
        body.appendChild(fullContentRow);

        document.querySelector('#detail-modal .modal-footer').style.display = 'flex';
        
        // Atualizar link para copiar
        this.currentNormativaLink = safeLink;
        
        document.getElementById('detail-modal').classList.add('active');

        try {
            const normDocument = await this.loadNormativaDocument(normativa);
            if (requestId !== this.detailRequestId) return;
            fullContentRow.replaceChildren(this.createElement('label', '', 'Texto integral:'));
            const metadata = this.createElement(
                'p',
                'normative-metadata',
                `Versão ${normDocument.conteudo.versao ?? 'não informada'} · ` +
                `verificada em ${new Date(normDocument.verificado_em || normDocument.extraido_em).toLocaleString('pt-BR')}`
            );
            const text = this.createElement('pre', 'normative-full-text', normDocument.conteudo.texto);
            fullContentRow.append(metadata, text);

            const assets = [...(normDocument.conteudo.links || []),
                ...(normDocument.conteudo.imagens || []).map(image => image.src)];
            const safeAssets = [...new Set(assets.map(value => this.getSafeNormativaLink(value)).filter(Boolean))];
            if (safeAssets.length) {
                const assetsRow = this.createDetailRow('Elementos e anexos preservados:');
                const list = this.createElement('ul', 'normative-assets');
                safeAssets.forEach((asset, index) => {
                    const item = window.document.createElement('li');
                    const anchor = this.createElement('a', '', `Abrir elemento ${index + 1}`);
                    anchor.href = asset;
                    anchor.target = '_blank';
                    anchor.rel = 'noopener noreferrer';
                    item.appendChild(anchor);
                    list.appendChild(item);
                });
                assetsRow.appendChild(list);
                body.appendChild(assetsRow);
            }
        } catch (error) {
            if (requestId !== this.detailRequestId) return;
            loading.textContent = 'Conteúdo detalhado indisponível. Use o link oficial do BCB.';
            console.error('Erro ao carregar texto integral:', error);
        }
    }

    async loadNormativaDocument(normativa) {
        const itemId = String(normativa.id || '');
        const year = String(normativa.data || '').slice(0, 4);
        if (!/^normativos_[A-Za-z0-9_-]+$/.test(itemId) || !/^20\d{2}$/.test(year)) {
            throw new Error('Identificador de normativa inválido');
        }
        const response = await fetch(`./normativas/${year}/${itemId}/normativa.json`, {
            cache: 'no-store'
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const document = await response.json();
        if (!document?.conteudo?.texto) throw new Error('Documento detalhado inválido');
        return document;
    }

    createDetailRow(labelText) {
        const row = this.createElement('div', 'detail-row');
        row.appendChild(this.createElement('label', '', labelText));
        return row;
    }

    getSafeNormativaLink(link) {
        try {
            const url = new URL(link);
            const isBacenHost = url.hostname === 'bcb.gov.br' || url.hostname.endsWith('.bcb.gov.br');
            return url.protocol === 'https:' && isBacenHost ? url.href : null;
        } catch {
            return null;
        }
    }

    showTooltip(e, normativa) {
        const tooltip = document.getElementById('tooltip');
        const content = tooltip.querySelector('.tooltip-content');
        content.replaceChildren(
            this.createElement('div', 'tooltip-title', normativa.nome),
            this.createElement('div', 'tooltip-description', `${normativa.descricao.substring(0, 150)}...`)
        );

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
                btn.replaceChildren(
                    this.createElement('i', 'fas fa-check'),
                    document.createTextNode(' Copiado!')
                );
                setTimeout(() => {
                    btn.replaceChildren(
                        this.createElement('i', 'fas fa-copy'),
                        document.createTextNode(' Copiar Link')
                    );
                }, 2000);
            });
        }
    }

    exportData() {
        const data = {
            exportDate: new Date().toISOString(),
            year: this.currentYear,
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
        a.download = `normativas_bacen_${this.currentYear}_export_${new Date().toISOString().split('T')[0]}.json`;
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
